// controllers/shopController.js
const Shop = require('../models/Shop');
const Owner = require('../models/Owner'); // To link shop to owner
const Service = require('../models/Service'); // For shop services
const Barber = require('../models/Barber'); // For shop barbers
const Subscription = require('../models/Subscription'); // For shop subscriptions
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');
const sanitizeHtml = require('sanitize-html'); // For sanitizing HTML inputs
require('dotenv').config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL; // IMPORTANT: Set this to your public backend URL

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// UTILITY: Calculate subscription end date
const calculateEndDate = (startDate, durationValue, durationUnit) => {
    const date = new Date(startDate);
    switch (durationUnit) {
        case 'days':
            date.setDate(date.getDate() + durationValue);
            break;
        case 'months':
            date.setMonth(date.getMonth() + durationValue);
            break;
        case 'years':
            date.setFullYear(date.getFullYear() + durationValue);
            break;
        default:
            throw new Error('Invalid duration unit');
    }
    return date;
};


// @desc    Create a new shop (by Owner)
// @route   POST /api/shops
// @access  Private (Owner)
exports.createShop = asyncHandler(async (req, res) => {

    console.log("Incoming shop creation body:", req.body);

    const { name, address, photos } = req.body; // Owner ID comes from req.user._id

    // Basic validation
 if ( !name ||!address || !address.fullDetails || !address.coordinates || address.coordinates.type !== 'Point' ||!Array.isArray(address.coordinates.coordinates) ||address.coordinates.coordinates.length !== 2) {
  throw new ApiError('Missing required shop details (name, full address, coordinates).', 400);
}


    const owner = await Owner.findById(req.user._id);
    if (!owner) {
        throw new ApiError('Owner not found.', 404);
    }

    const trialPeriodInDays = 30; // Default trial period for shops
    const trialStartDate = new Date();
    const trialEndDate = calculateEndDate(trialStartDate, trialPeriodInDays, 'days');

    const newShop = await Shop.create({
        name,
        owner: owner._id,
        address: {
            fullDetails: address.fullDetails,
            coordinates: address.coordinates, // [longitude, latitude]
        },
        photos: photos || [],
        subscription: {
            status: 'trial',
            trialEndDate: trialEndDate,
        }
    });

    // Add shop to owner's shops array
    owner.shops.push(newShop._id);
    await owner.save();

    res.status(201).json({
        success: true,
        message: 'Shop created successfully',
        data: {
            _id: newShop._id,
            name: newShop.name,
            address: newShop.address,
            subscription: newShop.subscription,
        },
    });
});

// @desc    Get shop by ID
// @route   GET /api/shops/:id
// @access  Public
exports.getShopById = asyncHandler(async (req, res) => {
    const shop = await Shop.findById(req.params.id)
                           .populate('owner', 'name phone')
                           .populate('services.service', 'name') // Populate generic service name
                           .populate('barbers', 'name phone activeTaking');

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    // Dynamic subscription status check
    const now = new Date();
    let statusUpdated = false;

    if (shop.subscription.status === 'trial' && shop.subscription.trialEndDate && shop.subscription.trialEndDate < now) {
        shop.subscription.status = 'expired';
        shop.subscription.trialEndDate = undefined;
        statusUpdated = true;
    } else if (shop.subscription.status === 'active' && shop.subscription.lastPlanInfo && shop.subscription.lastPlanInfo.endDate && shop.subscription.lastPlanInfo.endDate < now) {
        shop.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await shop.save();
    }

    res.json({
        success: true,
        data: shop,
    });
});

// @desc    Get all shops (for discovery)
// @route   GET /api/shops
// @access  Public
exports.getAllShops = asyncHandler(async (req, res) => {
    // You can add query parameters for pagination, filtering (e.g., by location, service, rating)
    const shops = await Shop.find({ "subscription.status": { $ne: 'expired' } }) // Only show non-expired shops
                            .select('name address rating photos subscription.status') // Select relevant fields for listing
                            .populate('owner', 'name'); // Optionally populate owner name

    res.json({
        success: true,
        data: shops,
    });
});

// @desc    Update shop details (by Owner)
// @route   PUT /api/shops/:id
// @access  Private (Owner)
exports.updateShopDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, photos } = req.body;

    const shop = await Shop.findById(id);

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    // Authorization: Ensure the logged-in owner owns this shop
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to update this shop.', 403);
    }

    shop.name = name || shop.name;
    if (address) {
        shop.address.fullDetails = address.fullDetails || shop.address.fullDetails;
        shop.address.coordinates = address.coordinates || shop.address.coordinates;
    }
    shop.photos = photos || shop.photos;

    const updatedShop = await shop.save();

    res.json({
        success: true,
        message: 'Shop updated successfully',
        data: updatedShop,
    });
});

// @desc    Delete a shop (by Owner)
// @route   DELETE /api/shops/:id
// @access  Private (Owner)
exports.deleteShop = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    // Authorization: Ensure the logged-in owner owns this shop
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to delete this shop.', 403);
    }

    // Remove shop from owner's shops array
    const owner = await Owner.findById(req.user._id);
    if (owner) {
        owner.shops = owner.shops.filter(shopId => shopId.toString() !== id);
        await owner.save();
    }

    // Consider deleting associated barbers, queue entries, and history records
    // For simplicity, we'll just delete the shop document here.
    await shop.deleteOne();

    res.json({
        success: true,
        message: 'Shop deleted successfully',
    });
});

// @desc    Add a service with its specific price to a shop's offerings (by Owner)
// @route   POST /api/shops/:id/services
// @access  Private (Owner)
exports.addService = asyncHandler(async (req, res) => {
    const { name, price } = req.body;

    // Validate input
    if (!name || !price) {
        throw new ApiError('Name and price are required', 400);
    }

    // Find shop and verify ownership
    const shop = await Shop.findOne({
        _id: req.params.id,
        owner: req.user.id
    });

    if (!shop) {
        throw new ApiError('Shop not found or not owned by you', 404);
    }

    // Check for duplicate service names (case insensitive)
    const serviceExists = shop.services.some(
        service => service.name.toLowerCase() === name.toLowerCase()
    );

    if (serviceExists) {
        throw new ApiError('This service already exists in your shop', 400);
    }

    // Add the new service
    shop.services.push({ name, price });
    await shop.save();

    res.status(201).json({
        success: true,
        message: 'Service added successfully',
        data: shop.services[shop.services.length - 1]
    });
});


// @desc    Update the price of an existing service at a specific shop (by Owner)
// @route   PUT /api/shops/:id/services/:serviceItemId
// @access  Private (Owner)
exports.updateShopServicePrice = asyncHandler(async (req, res) => {
    const { id, serviceItemId } = req.params;
    const { name, price } = req.body;

    const shop = await Shop.findById(id);
    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }
    
    // Authorization
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to modify this shop.', 403);
    }

    const serviceItem = shop.services.id(serviceItemId);
    if (!serviceItem) {
        throw new ApiError('Service item not found in this shop\'s offerings.', 404);
    }

    // Update both name and price if provided
    if (name) serviceItem.name = name;
    if (price) serviceItem.price = price;
    
    await shop.save();

    res.json({
        success: true,
        message: 'Service updated successfully',
        data: serviceItem,
    });
});

// @desc    Remove a service from a shop's offerings (by Owner)
// @route   DELETE /api/shops/:id/services/:serviceItemId
// @access  Private (Owner)
exports.removeServiceFromShop = asyncHandler(async (req, res) => {
    const { id, serviceItemId } = req.params; // shopId and the _id of the service subdocument

    const shop = await Shop.findById(id);
    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }
    // Authorization
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to modify this shop.', 403);
    }

    // Use $pull to remove the subdocument by its _id
    const updatedShop = await Shop.findByIdAndUpdate(
        id,
        { $pull: { services: { _id: serviceItemId } } },
        { new: true } // Return the updated document
    );

    if (!updatedShop) { // This case might mean shop not found initially, or item not found after pull
        throw new ApiError('Failed to remove service or service item not found.', 400);
    }

    res.json({
        success: true,
        message: 'Service removed from shop successfully',
        data: updatedShop.services,
    });
});

// @desc    Get a shop's rate list (services and their prices)
// @route   GET /api/shops/:id/rate-list
// @access  Public
exports.getShopRateList = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    res.json({
        success: true,
        data: shop.services,
    });
});

// @desc    Get a shop's current subscription status
// @route   GET /api/shops/:id/subscription-status
// @access  Private (Owner, Admin)
exports.getShopSubscriptionStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shop = await Shop.findById(id).select('subscription owner');

    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }

    // Authorization: Only owner of the shop or Admin can view
    if (req.userType === 'Owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view this shop\'s subscription status', 403);
    }
    // Admin user has implicit access

    // The checkShopSubscription middleware would have already updated the status if needed.
    res.json({
        success: true,
        data: shop.subscription,
    });
});


// --- Razorpay Payment Integration for Shops ---

// @desc    Serve Razorpay checkout page for shop subscription
// @route   GET /api/shops/payment/checkout-page
// @access  Private (Owner)
exports.serveRazorpayCheckoutPageShop = asyncHandler(async (req, res) => {
    const { order_id, key_id, amount, currency, name, description, prefill_email, prefill_contact, theme_color, shopId } = req.query;

    if (!order_id || !key_id || !amount || !currency || !name || !description || !shopId) {
        return res.status(400).send('Missing required parameters for checkout page.');
    }

    const callback_url_base = `${API_PUBLIC_URL}/shops/payment/webview-callback`; // Use public URL

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
                shop_id: "${s(shopId)}"
              }).toString();
              window.location.href = "${callback_url_base}/success?" + successParams;
            },
            "prefill": {
              "name": "${s(req.user.name)}", // Use authenticated owner's name
              "email": "${s(prefill_email)}",
              "contact": "${s(req.user.phone)}" // Use authenticated owner's phone
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
                  shop_id: "${s(shopId)}"
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
                shop_id: "${s(shopId)}"
            }).toString();
            window.location.href = "${callback_url_base}/failure?" + failureParams;
          }
        </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
});

// NEW: Dummy endpoints for WebView to navigate to. Frontend handles logic.
exports.handleWebViewCallbackSuccessShop = asyncHandler(async (req, res) => {
  const description = "Payment processing. You can close this window if it doesn't close automatically.";
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Successful</h1><p>${description}</p></body></html>`);
});

exports.handleWebViewCallbackFailureShop = asyncHandler(async (req, res) => {
  const description = sanitizeHtml(req.query.description || "Payment failed or was cancelled.", { allowedTags: [], allowedAttributes: {} });
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Failed</h1><p>${description}</p><p>You can close this window.</p></body></html>`);
});


// @desc    Create a Razorpay order for shop subscription
// @route   POST /api/shops/payment/create-order
// @access  Private (Owner)
exports.createShopPaymentOrder = asyncHandler(async (req, res) => {
    const { amount, currency = 'INR', shopId, planId } = req.body; // planId is the Subscription ObjectId

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new ApiError('A valid positive amount is required.', 400);
    }
    if (!shopId) {
        throw new ApiError('Shop ID is required for creating an order record.', 400);
    }
    if (!planId) {
        throw new ApiError('Subscription plan ID is required.', 400);
    }

    // Verify the shop belongs to the owner
    const shop = await Shop.findOne({ _id: shopId, owner: req.user._id });
    if (!shop) {
        throw new ApiError('Shop not found or you are not the owner of this shop.', 404);
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
        amount: amountInPaise,
        currency,
        receipt: `receipt_shop_${shopId}_${Date.now()}`,
        notes: {
            shopId: shopId,
            planId: planId,
            description: "Shop Subscription Payment"
        }
    };

    const order = await razorpayInstance.orders.create(options);
    if (!order) {
        throw new ApiError("Razorpay order creation failed.", 500);
    }
    res.json({ success: true, data: order });
});

// @desc    Verify payment and update shop subscription status
// @route   POST /api/shops/payment/verify
// @access  Private (Owner)
exports.verifyShopPaymentAndUpdateSubscription = asyncHandler(async (req, res) => {
    const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        shopId,
        planId, // Subscription plan ID
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !shopId || !planId) {
        throw new ApiError('Missing required payment verification details.', 400);
    }

    const body_string = razorpay_order_id + '|' + razorpay_payment_id;
    const isValidSignature = validateWebhookSignature(body_string, RAZORPAY_KEY_SECRET);

    if (!isValidSignature) {
        throw new ApiError('Invalid payment signature.', 400);
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    // Authorization: Ensure the logged-in owner owns this shop
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to update subscription for this shop.', 403);
    }

    const subscriptionPlan = await Subscription.findById(planId);
    if (!subscriptionPlan) {
        throw new ApiError('Subscription plan not found.', 404);
    }

    const paymentDocument = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (!paymentDocument) {
        throw new ApiError("Could not fetch payment details from Razorpay.", 500);
    }
    if (paymentDocument.status !== 'captured') {
        throw new ApiError(`Payment not successful. Status: ${paymentDocument.status}`, 400);
    }
    if (paymentDocument.order_id !== razorpay_order_id) {
        throw new ApiError("Order ID mismatch.", 400);
    }

    const now = new Date();
    let currentSubscriptionEndDate = shop.subscription.status === 'active' && shop.subscription.lastPlanInfo && shop.subscription.lastPlanInfo.endDate
                                    ? new Date(shop.subscription.lastPlanInfo.endDate)
                                    : now;

    // If current subscription is expired or trial, new subscription starts now.
    // Otherwise, it extends from the current end date.
    const newSubscriptionStartDate = (currentSubscriptionEndDate < now || shop.subscription.status === 'expired' || shop.subscription.status === 'trial')
                                     ? now
                                     : currentSubscriptionEndDate;

    const newSubscriptionEndDate = calculateEndDate(
        newSubscriptionStartDate,
        subscriptionPlan.duration.value,
        subscriptionPlan.duration.unit
    );

    shop.subscription.status = 'active';
    shop.subscription.trialEndDate = undefined; // Clear trial end date once active
    shop.subscription.lastPlanInfo = {
        transactionId: razorpay_payment_id, // Using payment_id as transactionId
        plan: subscriptionPlan._id,
        startDate: newSubscriptionStartDate,
        endDate: newSubscriptionEndDate,
    };

    await shop.save();

    res.json({
        success: true,
        message: 'Payment verified and shop subscription updated successfully.',
        data: {
            subscriptionStatus: shop.subscription.status,
            subscriptionEndDate: shop.subscription.lastPlanInfo.endDate,
            subscriptionStartDate: shop.subscription.lastPlanInfo.startDate,
            planName: subscriptionPlan.name,
        }
    });
});
