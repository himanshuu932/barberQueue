const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop'); // Adjust path if necessary
const dotenv = require("dotenv");
const Razorpay = require('razorpay');
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');
const sanitizeHtml = require('sanitize-html'); // For sanitizing HTML inputs

dotenv.config();

const JWT_SECRET = process.env.SECRET || 'your-very-secure-default-secret-key';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ;
API_PUBLIC_URL='https://numbr-p7zc.onrender.com'; // IMPORTANT: Set this to your public backend URL

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// UTILITY: Calculate trial end date
const calculateTrialEndDate = (startDate, days) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return date;
};

// --- Authentication Controllers ---
exports.signup = async (req, res) => {
  try {
    const { name, email, password, expoPushToken, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingShop = await Shop.findOne({ email });
    if (existingShop) {
      return res.status(400).json({ message: 'A shop with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const trialPeriodInDays = 30; // Default trial period
    const trialStartDate = new Date();
    const trialEndDate = calculateTrialEndDate(trialStartDate, trialPeriodInDays);

    const newShop = new Shop({
      name,
      email,
      password: hashedPassword,
      expoPushToken: expoPushToken || null,
      address: address || { textData: "", x: 0, y: 0 },
      trialStatus: 'trial',
      trialStartDate,
      trialEndDate
    });

    await newShop.save();

    const token = jwt.sign(
      { id: newShop._id, email: newShop.email },
      JWT_SECRET,
      { expiresIn: '30d' } // Token expiration
    );

    res.status(201).json({
        token,
        shop: {
            id: newShop._id,
            name: newShop.name,
            email: newShop.email,
            trialStatus: newShop.trialStatus,
            trialEndDate: newShop.trialEndDate,
            address: newShop.address
        }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Dynamically check and update trial status if expired
    if (shop.trialStatus !== 'expired' && shop.trialStatus !== 'active' && shop.trialEndDate && new Date(shop.trialEndDate) < new Date()) {
        shop.trialStatus = 'expired';
        await shop.save(); // Save the updated status
    }

    const token = jwt.sign(
      { id: shop._id, email: shop.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      shop: {
        id: shop._id,
        name: shop.name,
        email: shop.email,
        trialStatus: shop.trialStatus,
        trialStartDate: shop.trialStartDate,
        trialEndDate: shop.trialEndDate,
        address: shop.address
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
};

// --- Profile Controllers ---
exports.getProfile = async (req, res) => {
  try {
    const shopId = req.query.id; // Assuming shop ID comes from authenticated user or query for admin

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    const shop = await Shop.findById(shopId).select('-password -barbers -queues'); // Exclude sensitive/large fields by default
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    // Dynamically check and update trial status if expired
    if (shop.trialStatus !== 'expired' && shop.trialStatus !== 'active' && shop.trialEndDate && new Date(shop.trialEndDate) < new Date()) {
        // This is a GET request, ideally, it shouldn't modify state.
        // However, for user convenience, updating status here.
        // A more robust solution would be a scheduled job or updates on mutation requests.
        await Shop.findByIdAndUpdate(shopId, { trialStatus: 'expired' });
        shop.trialStatus = 'expired'; // Reflect change in the response
    }

    res.json(shop);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: "Server error while fetching profile." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { shopId, name, email, address } = req.body; // shopId could also come from req.user.id if using JWT middleware

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email; // Add validation for email format if desired
    if (address && typeof address === 'object') {
        updateData.address = {
            textData: address.textData !== undefined ? address.textData : '',
            x: address.x !== undefined ? address.x : 0,
            y: address.y !== undefined ? address.y : 0,
        };
    }


    // If email is being updated, check if it's already taken by another shop
    if (email) {
        const existingShopWithEmail = await Shop.findOne({ email: email, _id: { $ne: shopId } });
        if (existingShopWithEmail) {
            return res.status(400).json({ message: "This email is already in use by another account." });
        }
    }

    const updatedShop = await Shop.findByIdAndUpdate(shopId, { $set: updateData }, {
      new: true,
      runValidators: true // Ensure schema validations are run
    }).select('-password');

    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ message: "Profile updated successfully.", shop: updatedShop });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) { // Duplicate email error from MongoDB
        return res.status(400).json({ message: "This email is already in use." });
    }
    res.status(500).json({ message: "Server error while updating profile." });
  }
};

// --- Address & Coordinates ---
exports.updateAddress = async (req, res) => { // This is now part of updateProfile, but can be kept separate if needed
  try {
    const { shopId, address } = req.body;

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }
    if (!address || typeof address !== 'object' ||
        address.textData === undefined || address.x === undefined || address.y === undefined) {
      return res.status(400).json({ message: "A valid address object with textData, x, and y is required." });
    }

    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $set: { address: address } },
      { new: true, runValidators: true }
    ).select('address');

    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ message: "Address updated successfully.", address: updatedShop.address });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ message: "Server error while updating address." });
  }
};

exports.getCoordinates = async (req, res) => {
  try {
    const shopId = req.query.id;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    const shop = await Shop.findById(shopId).select("address.x address.y"); // Select only x and y
    if (!shop || !shop.address) { // Check if shop or address exists
      return res.status(404).json({ message: "Shop or address not found." });
    }
    // The schema defaults x and y to 0, so they should exist.
    res.json({ x: shop.address.x, y: shop.address.y });
  } catch (error) {
    console.error("Error fetching coordinates:", error);
    res.status(500).json({ message: "Server error while fetching coordinates." });
  }
};


// --- Push Notification Token ---
exports.registerForPushNotifications = async (req, res) => {
  try {
    const { uid, token } = req.body; // uid here refers to shopId
    if (!uid || !token) {
      return res.status(400).json({ error: "Shop ID (uid) and token are required." });
    }
    const shop = await Shop.findByIdAndUpdate(uid, { expoPushToken: token }, { new: true });
    if (!shop) {
      return res.status(404).json({ error: "Shop not found." });
    }
    res.json({ message: "Push token registered successfully." });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({ error: "Internal server error during push token registration." });
  }
};

// --- Shop Listing (for users/admins) ---
exports.getAllShops = async (req, res) => {
  try {
    // Add pagination, filtering, sorting as needed
    const shops = await Shop.find({ trialStatus: { $ne: 'expired' } }) // Example filter
      .select('_id name email address trialStatus trialEndDate rateList'); // Select fields relevant for a listing
    res.json(shops);
  } catch (error) {
    console.error("Error fetching all shops:", error);
    res.status(500).json({ message: "Server error while fetching shops." });
  }
};

// --- Rate List CRUD ---
exports.getRateList = async (req, res) => {
  try {
    const shopId = req.query.id;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }
    const shop = await Shop.findById(shopId).select('rateList');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json(shop.rateList || []); // Return empty array if rateList is null/undefined
  } catch (error) {
    console.error("Error fetching rate list:", error);
    res.status(500).json({ message: "Server error while fetching rate list." });
  }
};

exports.addRateListItem = async (req, res) => {
  try {
    const { shopId, service, price } = req.body;
    if (!shopId || !service || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: "Shop ID, service name, and a valid non-negative price are required." });
    }

    const newItem = { service, price }; // Mongoose assigns _id automatically
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $push: { rateList: newItem } },
      { new: true, runValidators: true }
    ).select('rateList');

    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.status(201).json({ message: "Rate list item added successfully.", rateList: updatedShop.rateList });
  } catch (error) {
    console.error("Error adding rate list item:", error);
    res.status(500).json({ message: "Server error while adding rate list item." });
  }
};

exports.updateRateListItem = async (req, res) => {
  try {
    const { shopId, rateItemId, service, price } = req.body;
    if (!shopId || !rateItemId || !service || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: "Shop ID, rate item ID, service name, and a valid non-negative price are required." });
    }

    // Find the shop and update the specific item in the rateList array
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    const rateItem = shop.rateList.id(rateItemId); // Mongoose subdocument finding
    if (!rateItem) {
      return res.status(404).json({ message: "Rate list item not found." });
    }

    rateItem.service = service;
    rateItem.price = price;
    await shop.save(); // Save the parent document

    res.json({ message: "Rate list item updated successfully.", rateList: shop.rateList });
  } catch (error) {
    console.error("Error updating rate list item:", error);
    res.status(500).json({ message: "Server error while updating rate list item." });
  }
};

exports.deleteRateListItem = async (req, res) => {
  try {
    // Assuming shopId and rateItemId are in req.body. For DELETE, req.params might be more RESTful.
    const { shopId, rateItemId } = req.body;
    if (!shopId || !rateItemId) {
      return res.status(400).json({ message: "Shop ID and rate item ID are required." });
    }

    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $pull: { rateList: { _id: rateItemId } } }, // Remove item from array
      { new: true }
    ).select('rateList');

    if (!updatedShop) {
      // This might also mean the item wasn't found, or the shop wasn't found.
      // To be more specific, one could first find the shop, then check if the pull was successful.
      return res.status(404).json({ message: "Shop not found or rate list item not found." });
    }
    res.json({ message: "Rate list item deleted successfully.", rateList: updatedShop.rateList });
  } catch (error) {
    console.error("Error deleting rate list item:", error);
    res.status(500).json({ message: "Server error while deleting rate list item." });
  }
};

// --- History (Placeholder - depends on actual structure of shop.history) ---
// These are based on the previous controller names. The actual implementation
// depends on what `shop.history` is supposed to store.
// If `shop.history` stores aggregated data or specific shop events, then:
exports.getHistoryByDate = async (req, res) => {
  try {
    const shopId = req.query.id;
    const { date } = req.params;

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }
    if (!date) {
        return res.status(400).json({ message: "Date parameter is required." });
    }

    const shop = await Shop.findById(shopId).select('history');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    // Assuming shop.history is an array of objects, each with a 'date' field.
    const targetDate = new Date(date).toDateString();
    const filteredHistory = (shop.history || []).filter(entry =>
      entry && entry.date && (new Date(entry.date).toDateString() === targetDate)
    );

    res.json(filteredHistory);
  } catch (error) {
    console.error('Error fetching history by date:', error);
    res.status(500).json({ message: "Server error while fetching history by date." });
  }
};

exports.getAllHistory = async (req, res) => {
  try {
    const shopId = req.query.id;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    const shop = await Shop.findById(shopId).select('history');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json(shop.history || []); // Return empty array if history is null/undefined
  } catch (error) {
    console.error('Error fetching all history:', error);
    res.status(500).json({ message: "Server error while fetching all history." });
  }
};


// --- Payment Controllers ---
exports.serveRazorpayCheckoutPage = async (req, res) => {
  try {
    const {
      order_id,
      key_id, // This is your Razorpay Key ID
      amount, // Amount in paise
      currency,
      name, // App/Shop Name
      description,
      prefill_name,
      prefill_email,
      prefill_contact, // Optional
      theme_color,
      shop_id // Your internal shopId for callback construction
    } = req.query;

    if (!order_id || !key_id || !amount || !currency || !name || !description || !shop_id) {
      return res.status(400).send('Missing required parameters for checkout page.');
    }

    const callback_url_base = `${API_PUBLIC_URL}/shop/payment/webview-callback`; // Use public URL

    // Sanitize inputs before embedding in HTML
    const s = (str) => sanitizeHtml(str || '', { allowedTags: [], allowedAttributes: {} });
    const safeThemeColor = theme_color && /^#[0-9A-F]{6}$/i.test(theme_color) ? theme_color : '#1a1a1a';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Payment</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
          .container { text-align: center; padding: 25px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .loader { border: 5px solid #e0e0e0; border-top: 5px solid ${safeThemeColor}; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 25px auto; }
          p { color: #333; font-size: 16px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <p>Loading payment options...</p>
          <div class="loader"></div>
          <p>Please do not close or refresh this page.</p>
        </div>
        <script>
          var options = {
            "key": "${s(key_id)}",
            "amount": "${s(amount)}",
            "currency": "${s(currency)}",
            "name": "${s(name)}",
            "description": "${s(description)}",
            "image": "https://i.imgur.com/3g7nmJC.jpg", // Your logo
            "order_id": "${s(order_id)}",
            "handler": function (response){
              var successParams = new URLSearchParams({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                shop_id: "${s(shop_id)}"
              }).toString();
              window.location.href = "${callback_url_base}/success?" + successParams;
            },
            "prefill": {
              "name": "${s(prefill_name)}",
              "email": "${s(prefill_email)}",
              "contact": "${s(prefill_contact)}"
            },
            "theme": {
              "color": "${safeThemeColor}"
            },
            "modal": {
              "ondismiss": function(){
                var failureParams = new URLSearchParams({
                  code: "USER_CANCELLED",
                  description: "Payment was cancelled by the user.",
                  reason: "modal_dismissed",
                  order_id: "${s(order_id)}",
                  shop_id: "${s(shop_id)}"
                }).toString();
                window.location.href = "${callback_url_base}/failure?" + failureParams;
              }
            }
          };
          var rzp1 = new Razorpay(options);
          rzp1.on('payment.failed', function (response){
            var failureParams = new URLSearchParams({
              code: response.error.code,
              description: response.error.description,
              source: response.error.source || '',
              step: response.error.step || '',
              reason: response.error.reason,
              order_id: response.error.metadata && response.error.metadata.order_id ? response.error.metadata.order_id : "${s(order_id)}",
              payment_id: response.error.metadata && response.error.metadata.payment_id ? response.error.metadata.payment_id : ''
            }).toString();
            window.location.href = "${callback_url_base}/failure?" + failureParams;
          });
          // Open checkout automatically
          try {
            rzp1.open();
          } catch(e) {
            console.error("Razorpay open error:", e);
            var failureParams = new URLSearchParams({
                code: "RZP_OPEN_ERROR",
                description: "Could not initialize Razorpay checkout.",
                reason: e.message || "Unknown client-side error",
                order_id: "${s(order_id)}",
                shop_id: "${s(shop_id)}"
            }).toString();
            window.location.href = "${callback_url_base}/failure?" + failureParams;
          }
        </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);

  } catch (error) {
    console.error('Error serving Razorpay checkout page:', error);
    res.status(500).send('Error generating checkout page.');
  }
};

// NEW: Dummy endpoints for WebView to navigate to. Frontend handles logic.
exports.handleWebViewCallbackSuccess = async (req, res) => {
  const description = "Payment processing. You can close this window if it doesn't close automatically.";
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Successful</h1><p>${description}</p></body></html>`);
};

exports.handleWebViewCallbackFailure = async (req, res) => {
  const description = sanitizeHtml(req.query.description || "Payment failed or was cancelled.", { allowedTags: [], allowedAttributes: {} });
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Failed</h1><p>${description}</p><p>You can close this window.</p></body></html>`);
};


exports.createPaymentOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', shopId } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'A valid positive amount is required.' });
    }
    if (!shopId) {
        return res.status(400).json({ message: 'Shop ID is required for creating an order record.' });
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency,
      receipt: `receipt_shop_${shopId}`, // More unique receipt
      notes: {
        shopId: shopId,
        description: "Subscription/Service Payment"
      }
    };

    const order = await razorpayInstance.orders.create(options);
    if (!order) {
        return res.status(500).json({ message: "Razorpay order creation failed." });
    }
    res.json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    const errorMessage = error.error && error.error.description ? error.error.description : 'Error creating payment order.';
    res.status(error.statusCode || 500).json({ message: errorMessage, errorDetails: error.error });
  }
};

exports.verifyPaymentAndUpdateTrial = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      shopId,
      planId,
    } = req.body;
   console.log('Payment verification request:', req.body);
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !shopId || !planId) {
      return res.status(400).json({ message: 'Missing required payment verification details.' });
    }

    const body_string = razorpay_order_id + '|' + razorpay_payment_id;
    const isValidSignature = validateWebhookSignature(body_string, razorpay_signature, RAZORPAY_KEY_SECRET);

    if (isValidSignature) {
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ message: 'Shop not found.' });
      }

      const paymentDocument = await razorpayInstance.payments.fetch(razorpay_payment_id);
      if (!paymentDocument) {
        return res.status(500).json({ message: "Could not fetch payment details from Razorpay." });
      }
      if (paymentDocument.status !== 'captured') {
        return res.status(400).json({ message: `Payment not successful. Status: ${paymentDocument.status}` });
      }
      if (paymentDocument.order_id !== razorpay_order_id) {
        return res.status(400).json({ message: "Order ID mismatch." });
      }

      let durationInDays;
      const planDurations = {
          'monthly': 30,
          'quarterly': 90,
          'halfYearly': 180,
          'yearly': 365
      };
      durationInDays = planDurations[planId];

      if (!durationInDays) {
        return res.status(400).json({ message: 'Invalid plan ID provided.' });
      }

      const now = new Date();
      let currentSubscriptionEndDate = shop.trialEndDate ? new Date(shop.trialEndDate) : now;

      const newSubscriptionStartDate = (currentSubscriptionEndDate < now || shop.trialStatus === 'expired' || shop.trialStatus === 'trial')
                                       ? now
                                       : currentSubscriptionEndDate;

      const newSubscriptionEndDate = calculateTrialEndDate(newSubscriptionStartDate, durationInDays);

      shop.trialStatus = 'active';
      shop.trialEndDate = newSubscriptionEndDate;
      shop.trialStartDate = newSubscriptionStartDate;
      shop.lastPaymentDetails = {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          planId: planId,
          paymentDate: new Date(paymentDocument.created_at * 1000),
          amountPaid: paymentDocument.amount
      };

      await shop.save();

      res.json({
        status: 'ok',
        message: 'Payment verified and subscription updated successfully.',
        shop: {
            trialStatus: shop.trialStatus,
            trialEndDate: shop.trialEndDate,
            trialStartDate: shop.trialStartDate
        }
      });
    } else {
      res.status(400).json({ status: 'verification_failed', message: 'Invalid payment signature.' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    const errorMessage = error.error && error.error.description ? error.error.description : 'Server error during payment verification.';
    res.status(error.statusCode || 500).json({ message: errorMessage, errorDetails: error.error });
  }
};
