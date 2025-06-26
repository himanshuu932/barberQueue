// controllers/userController.js
const User = require('../models/User');
const Shop = require('../models/Shop'); // For pinned shops
const Subscription = require('../models/Subscription'); // For user subscriptions
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');
const sanitizeHtml = require('sanitize-html'); // For sanitizing HTML inputs
require('dotenv').config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL; 



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

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = asyncHandler(async (req, res) => {
   console.log("reached to register backend", req.body); // Good
    const { name, email, pass, expoPushToken } = req.body;

    const userExists = await User.findOne({ email });
    

    if (userExists) {
        console.log("another user exists with this email"+ email);
        throw new ApiError('User already exists with this email', 400); 
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const trialPeriodInDays = 7; 
    const trialStartDate = new Date();
    const trialEndDate = calculateEndDate(trialStartDate, trialPeriodInDays, 'days');

    const user = await User.create({
        name,
        email,
        pass: hashedPassword,
         emailVerified: true,
        expopushtoken: expoPushToken || null,
        subscription: {
            status: 'trial',
            trialEndDate: trialEndDate,
        }
    });

    if (user) {
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                subscription: {
                    status: user.subscription.status,
                    trialEndDate: user.subscription.trialEndDate,
                },
                token: generateToken(user._id),
                emailVerified: user.emailVerified
            },
        });
    } else {
        throw new ApiError('Invalid user data', 400);
    }
});

// @desc    Authenticate user & get token
// @route   POST /api/users/login
// @access  Public
exports.loginUser = asyncHandler(async (req, res) => {
    const { email, pass } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(pass, user.pass))) {
        throw new ApiError('Invalid email or password', 401);
    }

    // Dynamic subscription status check on login
    const now = new Date();
    let statusUpdated = false;

    if (user.subscription.status === 'trial' && user.subscription.trialEndDate && user.subscription.trialEndDate < now) {
        user.subscription.status = 'expired';
        user.subscription.trialEndDate = undefined;
        statusUpdated = true;
    } else if (user.subscription.status === 'active' && user.subscription.lastPlanInfo && user.subscription.lastPlanInfo.endDate && user.subscription.lastPlanInfo.endDate < now) {
        user.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await user.save();
    }

    res.json({
        success: true,
        message: 'User logged in successfully',
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            subscription: user.subscription, // Send updated status
            token: generateToken(user._id),
        },
    });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private (User)
exports.getUserProfile = asyncHandler(async (req, res) => {
    // req.user is populated by the protect middleware
    const user = await User.findById(req.user._id).select('-pass').populate('pinnedShop', 'name address'); // Exclude password and populate pinned shop details

    if (user) {
        res.json({
            success: true,
            data: user,
        });
    } else {
        throw new ApiError('User not found', 404);
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private (User)
exports.updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email
        if (req.body.pass) {
            const salt = await bcrypt.genSalt(10);
            user.pass = await bcrypt.hash(req.body.pass, salt);
        }
        if (req.body.expopushtoken) {
            user.expopushtoken = req.body.expopushtoken;
        }

        const updatedUser = await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
            },
        });
    } else {
        throw new ApiError('User not found', 404);
    }
});

// @desc    Delete user account
// @route   DELETE /api/users/me
// @access  Private (User)
exports.deleteUserAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // Optionally, also delete associated history records, queue entries etc.
    // For simplicity, we're just deleting the user document.
    await user.deleteOne();

    res.json({
        success: true,
        message: 'User account deleted successfully',
    });
});

// @desc    Pin a shop to user's profile
// @route   PUT /api/users/pin-shop/:shopId
// @access  Private (User)
exports.pinShop = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }

    user.pinnedShop = shopId;
    await user.save();

    res.json({
        success: true,
        message: 'Shop pinned successfully',
        data: { pinnedShop: shop.name },
    });
});

// @desc    Unpin a shop from user's profile
// @route   PUT /api/users/unpin-shop
// @access  Private (User)
exports.unpinShop = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    user.pinnedShop = undefined; // Set to undefined to remove the reference
    await user.save();

    res.json({
        success: true,
        message: 'Shop unpinned successfully',
    });
});

// @desc    Get user's current subscription status
// @route   GET /api/users/subscription-status
// @access  Private (User)
exports.getUserSubscriptionStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('subscription');

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // The checkUserSubscription middleware would have already updated the status if needed.
    res.json({
        success: true,
        data: user.subscription,
    });
});

// --- Razorpay Payment Integration for Users ---

// @desc    Serve Razorpay checkout page for user subscription
// @route   GET /api/users/payment/checkout-page
// @access  Private (User)
exports.serveRazorpayCheckoutPageUser = asyncHandler(async (req, res) => {
    const { order_id, key_id, amount, currency, name, description, prefill_email, prefill_contact, theme_color, userId } = req.query;

    if (!order_id || !key_id || !amount || !currency || !name || !description || !userId) {
        return res.status(400).send('Missing required parameters for checkout page.');
    }

    const callback_url_base = `${API_PUBLIC_URL}/users/payment/webview-callback`; // Use public URL

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
                user_id: "${s(userId)}"
              }).toString();
              window.location.href = "${callback_url_base}/success?" + successParams;
            },
            "prefill": {
              "name": "${s(req.user.name)}", // Use authenticated user's name
              "email": "${s(prefill_email)}",
              "contact": "${s(req.user.email)}" // Use authenticated user's email
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
                  user_id: "${s(userId)}"
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
                user_id: "${s(userId)}"
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
exports.handleWebViewCallbackSuccessUser = asyncHandler(async (req, res) => {
  const description = "Payment processing. You can close this window if it doesn't close automatically.";
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Successful</h1><p>${description}</p></body></html>`);
});

exports.handleWebViewCallbackFailureUser = asyncHandler(async (req, res) => {
  const description = sanitizeHtml(req.query.description || "Payment failed or was cancelled.", { allowedTags: [], allowedAttributes: {} });
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h1>Payment Failed</h1><p>${description}</p><p>You can close this window.</p></body></html>`);
});


// @desc    Create a Razorpay order for user subscription
// @route   POST /api/users/payment/create-order
// @access  Private (User)
exports.createUserPaymentOrder = asyncHandler(async (req, res) => {
    const { amount, currency = 'INR', planId } = req.body; // planId is the Subscription ObjectId

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new ApiError('A valid positive amount is required.', 400);
    }
    if (!planId) {
        throw new ApiError('Subscription plan ID is required.', 400);
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
        amount: amountInPaise,
        currency,
        receipt: `receipt_user_${req.user._id}_${Date.now()}`,
        notes: {
            userId: req.user._id.toString(),
            planId: planId,
            description: "User Subscription Payment"
        }
    };

    const order = await razorpayInstance.orders.create(options);
    if (!order) {
        throw new ApiError("Razorpay order creation failed.", 500);
    }
    res.json({ success: true, data: order });
});

// @desc    Verify payment and update user subscription status
// @route   POST /api/users/payment/verify
// @access  Private (User)
exports.verifyUserPaymentAndUpdateSubscription = asyncHandler(async (req, res) => {
    const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        planId, // Subscription plan ID
    } = req.body;

    const userId = req.user._id; // Get user ID from authenticated request

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId) {
        throw new ApiError('Missing required payment verification details.', 400);
    }

    const body_string = razorpay_order_id + '|' + razorpay_payment_id;
    const isValidSignature = validateWebhookSignature(body_string, razorpay_signature, RAZORPAY_KEY_SECRET);

    if (!isValidSignature) {
        throw new ApiError('Invalid payment signature.', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError('User not found.', 404);
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
    let currentSubscriptionEndDate = user.subscription.status === 'active' && user.subscription.lastPlanInfo && user.subscription.lastPlanInfo.endDate
                                    ? new Date(user.subscription.lastPlanInfo.endDate)
                                    : now;

    // If current subscription is expired or trial, new subscription starts now.
    // Otherwise, it extends from the current end date.
    const newSubscriptionStartDate = (currentSubscriptionEndDate < now || user.subscription.status === 'expired' || user.subscription.status === 'trial')
                                     ? now
                                     : currentSubscriptionEndDate;

    const newSubscriptionEndDate = calculateEndDate(
        newSubscriptionStartDate,
        subscriptionPlan.duration.value,
        subscriptionPlan.duration.unit
    );

    user.subscription.status = 'active';
    user.subscription.trialEndDate = undefined; // Clear trial end date once active
    user.subscription.lastPlanInfo = {
        transactionId: razorpay_payment_id, // Using payment_id as transactionId
        plan: subscriptionPlan._id,
        startDate: newSubscriptionStartDate,
        endDate: newSubscriptionEndDate,
    };

    await user.save();

    res.json({
        success: true,
        message: 'Payment verified and user subscription updated successfully.',
        data: {
            subscriptionStatus: user.subscription.status,
            subscriptionEndDate: user.subscription.lastPlanInfo.endDate,
            subscriptionStartDate: user.subscription.lastPlanInfo.startDate,
            planName: subscriptionPlan.name,
        }
    });
});
