// controllers/shopController.js
const Shop = require('../models/Shop');
const Owner = require('../models/Owner');
const Service = require('../models/Service');
const Barber = require('../models/Barber');
const Subscription = require('../models/Subscription');
const History = require('../models/History'); // Import History model for stats
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const { uploadMultipleImages } = require('../utils/cloudinaryUpload');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const { validateWebhookSignature } = require('razorpay/dist/utils/razorpay-utils');
const sanitizeHtml = require('sanitize-html');
const cloudinary = require('cloudinary').v2;

require('dotenv').config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_5ntRaY7OFb2Rq0';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'FdhuPV1HIA5bRYAIu2gYSoXh';
// IMPORTANT: Configure this URL based on your testing environment:
// - For Android Emulator: 'https://numbr-exq6.onrender.com'
// - For iOS Simulator/Device or Physical Android Device: Replace '10.0.2.2' with your computer's actual local IP address (e.g., 'http://192.168.1.X:5000')
// - For Production/Public access: This should be your deployed backend's public URL (e.g., 'https://api.yourdomain.com')
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'https://numbr-exq6.onrender.com'; 

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

    const { name, address, photos, openingTime, closingTime } = req.body; // Owner ID comes from req.user._id

  // console.log("Parsed shop creation details:", { name, address, photos, openingTime, closingTime });
    if (!name || !address || !address.fullDetails || !address.coordinates || address.coordinates.type !== 'Point' || !Array.isArray(address.coordinates.coordinates) || address.coordinates.coordinates.length !== 2) {
        throw new ApiError('Missing required shop details (name, full address, coordinates).', 400);
    }
   
    if (openingTime && !/^\d{2}:\d{2}$/.test(openingTime)) {
        throw new ApiError('Invalid opening time format. Use HH:MM.', 400);
    }
    if (closingTime && !/^\d{2}:\d{2}$/.test(closingTime)) {
        throw new ApiError('Invalid closing time format. Use HH:MM.', 400);
    }


    const owner = await Owner.findById(req.user._id);
    if (!owner) {
        throw new ApiError('Owner not found.', 404);
    }

    const trialPeriodInDays = 30; // Default trial period for shops
    const trialStartDate = new Date();
    const trialEndDate = calculateEndDate(trialStartDate, trialPeriodInDays, 'days');

    const newShopData = {
        name,
        owner: owner._id,
        address: {
            fullDetails: address.fullDetails,
            coordinates: address.coordinates, // [longitude, latitude]
        },
        // Photos are optional and handled here. If not provided, it will be an empty array or undefined,
        // which the schema handles.
        photos: photos || [], 
        subscription: {
            status: 'trial',
            trialEndDate: trialEndDate,
        },
        services: [], // Initialize services array
        barbers: [], // Initialize barbers array
        // isManuallyOverridden defaults to false as per schema. No need to set explicitly here unless true is desired.
    };

    if (openingTime) newShopData.openingTime = openingTime;
    if (closingTime) newShopData.closingTime = closingTime;


    const newShop = await Shop.create(newShopData);

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
            openingTime: newShop.openingTime,
            closingTime: newShop.closingTime,
            subscription: newShop.subscription,
        },
    });
});

// @desc    Get shop by ID
exports.getShopById = asyncHandler(async (req, res) => {
    const shop = await Shop.findById(req.params.id)
                           .populate('owner', 'name phone')
                           .populate('barbers', 'name phone activeTaking');

                        

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }
    //console.log("Fetched shop details:", shop);

    // Check and update subscription status
    const now = new Date();
    let statusUpdated = false;

    if (
        shop.subscription.status === 'trial' &&
        shop.subscription.trialEndDate &&
        shop.subscription.trialEndDate < now
    ) {
        shop.subscription.status = 'expired';
        shop.subscription.trialEndDate = undefined;
        statusUpdated = true;
    } else if (
        shop.subscription.status === 'active' &&
        shop.subscription.lastPlanInfo &&
        shop.subscription.lastPlanInfo.endDate &&
        shop.subscription.lastPlanInfo.endDate < now
    ) {
        shop.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await shop.save();
    }

    // Fetch history associated with this shop
    const history = await History.find({ shop: req.params.id })
        .populate('barber', 'name phone')
        .populate('services.service', 'name price') // populate only the service reference inside services array
        .sort({ date: -1 }); // Optional: sort latest first


    res.json({
        success: true,
        data: {
            shop,
            history
        }
    });
});


// @desc    Get all shops (for discovery)
// @route   GET /api/shops
// @access  Public
exports.getAllShops = asyncHandler(async (req, res) => {
    // You can add query parameters for pagination, filtering (e.g., by location, service, rating)
    const shops = await Shop.find({ "subscription.status": { $ne: 'expired' } }) // Only show non-expired shops
                            .select('name address rating photos subscription.status openingTime closingTime isOpen') // Select relevant fields for listing
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
    const { name, address, photos, openingTime, closingTime, isManuallyOverridden, isOpen } = req.body; // Added isOpen

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
        if (address.coordinates && address.coordinates.coordinates && address.coordinates.coordinates.length === 2) {
             shop.address.coordinates = address.coordinates;
        }
    }
    shop.photos = photos || shop.photos;
    shop.openingTime = openingTime || shop.openingTime;
    shop.closingTime = closingTime || shop.closingTime;

    if (typeof isManuallyOverridden === 'boolean') {
        shop.isManuallyOverridden = isManuallyOverridden;
    }
    
    // NEW: Update isOpen field if provided and is a boolean
    if (typeof isOpen === 'boolean') {
        shop.isOpen = isOpen;
    }

    const updatedShop = await shop.save();

    res.json({
        success: true,
        message: 'Shop updated successfully',
        data: updatedShop,
    });
});
// @desc    Delete a shop (by Owner)add
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
    await shop.deleteOne(); // Mongoose v6+ uses deleteOne() on a document

    res.json({
        success: true,
        message: 'Shop deleted successfully',
    });
});

// @desc    Add a service with its specific price to a shop's offerings (by Owner)
// @route   POST /api/shops/:id/services
// @access  Private (Owner)
exports.addService = asyncHandler(async (req, res) => {
    const { name, price } = req.body; // name and price are directly provided

    // Validate input
    if (!name || typeof price !== 'number' || price < 0) {
        throw new ApiError('Service name and a valid non-negative price are required', 400);
    }

    // Find shop and verify ownership
    const shop = await Shop.findOne({
        _id: req.params.id,
        owner: req.user.id // Assuming req.user.id is the owner's ObjectId
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

    // Add the new service directly as an object
    shop.services.push({ name, price });
    await shop.save();

    res.status(201).json({
        success: true,
        message: 'Service added successfully',
        data: shop.services[shop.services.length - 1] // Return the newly added service subdocument
    });
});


// @desc    Update the price of an existing service at a specific shop (by Owner)
// @route   PUT /api/shops/:id/services/:serviceItemId
// @access  Private (Owner)
exports.updateShopServicePrice = asyncHandler(async (req, res) => {
    const { id, serviceItemId } = req.params;
    const { name, price } = req.body; // Allow updating name as well

    const shop = await Shop.findById(id);
    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }
    
    // Authorization
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to modify this shop.', 403);
    }

    const serviceItem = shop.services.id(serviceItemId); // Mongoose subdocument find by _id
    if (!serviceItem) {
        throw new ApiError('Service item not found in this shop\'s offerings.', 404);
    }

    // Update name if provided and valid
    if (name && typeof name === 'string' && name.trim() !== '') {
        // Optional: Check for duplicate names if changing, excluding the current item
        const otherServiceExists = shop.services.some(
            s => s._id.toString() !== serviceItemId && s.name.toLowerCase() === name.toLowerCase()
        );
        if (otherServiceExists) {
            throw new ApiError('Another service with this name already exists in your shop', 400);
        }
        serviceItem.name = name.trim();
    }

    // Update price if provided and valid
    if (typeof price === 'number' && price >= 0) {
        serviceItem.price = price;
    } else if (price !== undefined) { // If price is provided but not valid
        throw new ApiError('Invalid price provided. Must be a non-negative number.', 400);
    }
    
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

    const serviceItem = shop.services.id(serviceItemId);
    if (!serviceItem) {
        throw new ApiError('Service item not found in this shop.', 404);
    }
    
    // Mongoose < v8 way to remove subdocument
    // serviceItem.remove(); 
    // Mongoose v8+ or general way using pull:
    shop.services.pull({ _id: serviceItemId });


    await shop.save();

    res.json({
        success: true,
        message: 'Service removed from shop successfully',
        data: { remainingServices: shop.services }, // Send back remaining services or just a success message
    });
});

// @desc    Get a shop's rate list (services and their prices)
// @route   GET /api/shops/:id/rate-list
// @access  Public
exports.getShopRateList = asyncHandler(async (req, res) => {
    const { id } = req.params;
console.log("reached to rate-list controller");
    const shop = await Shop.findById(id).select('services'); // Only select services

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    res.json({
        success: true,
        data: shop.services, // This will be an array of {name, price, _id} objects
    });
});



// @desc    Upload shop photos
// @route   POST /api/shops/:id/photos
// @access  Private (Owner)
// controllers/shopController.js
exports.uploadShopPhotos = [
    uploadMultipleImages('photos'),
    asyncHandler(async (req, res) => {
        console.log('Upload request received:', {
            files: req.files,
            body: req.body,
            params: req.params,
            user: req.user
        });

        const { id } = req.params;
        
        const shop = await Shop.findById(id);
        if (!shop) {
            console.error('Shop not found with ID:', id);
            throw new ApiError('Shop not found.', 404);
        }

        // Authorization
        if (shop.owner.toString() !== req.user._id.toString()) {
            console.error('Unauthorized access attempt by user:', req.user._id);
            throw new ApiError('Not authorized to update this shop.', 403);
        }

        if (!req.files || req.files.length === 0) {
            console.error('No files were uploaded');
            throw new ApiError('No photos uploaded.', 400);
        }

        console.log('Files received:', req.files.map(f => ({
            originalname: f.originalname,
            size: f.size,
            mimetype: f.mimetype
        })));

        try {
            // Map uploaded files to photo objects
          const uploadedPhotos = req.files.map(file => ({
  url: file.path,
   public_id: file.filename
}));


            console.log('Processed photos:', uploadedPhotos);

            // Add new photos to the shop
            shop.photos = [...shop.photos, ...uploadedPhotos];
            await shop.save();

            console.log('Shop updated successfully with new photos');
            
            res.status(201).json({
                success: true,
                message: 'Photos uploaded successfully',
                data: uploadedPhotos
            });
        } catch (error) {
            console.error('Error processing upload:', {
                message: error.message,
                stack: error.stack
            });
            throw new ApiError('Failed to process upload', 500);
        }
    })
];

// @desc    Delete a shop photo
// @route   DELETE /api/shops/:id/photos/:photoId
// @access  Private (Owner)
exports.deleteShopPhoto = asyncHandler(async (req, res) => {
    console.log("reached in delete shop photo controller");
    const { id, photoId } = req.params; // photoId is the public_id from the URL
    console.log("Deleting photo:", { shopId: id, photoId: photoId });

    const shop = await Shop.findById(id);
    if (!shop) {
        throw new ApiError("Shop not found.", 404);
    }

    // Authorization
    if (shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError("Not authorized to update this shop.", 403);
    }

    // Find the photo by its public_id in the array
    const photoToDelete = shop.photos.find(p => p.public_id === photoId);

    if (!photoToDelete) {
        throw new ApiError("Photo not found in this shop's records.", 404);
    }

    // Wrap Cloudinary and DB operations in a try-catch block
    try {
        // 1. Delete the image from Cloudinary
        console.log(`Attempting to delete from Cloudinary with public_id: ${photoToDelete.public_id}`);
        await cloudinary.uploader.destroy(photoToDelete.public_id);
        console.log("Successfully deleted from Cloudinary (or it didn't exist there).");

        // 2. Remove the photo from the MongoDB array
        shop.photos = shop.photos.filter(p => p.public_id !== photoId);
        
        await shop.save();

        res.json({
            success: true,
            message: "Photo deleted successfully.",
        });
    } catch (error) {
        console.error("Error during photo deletion process:", error);
        // This could be an error from Cloudinary or from saving the shop document
        throw new ApiError("Failed to delete photo due to a server error.", 500);
    }
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
    // Assuming req.userType is set by your auth middleware
    if (req.user.role === 'owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view this shop\'s subscription status', 403);
    }
    // Admin user has implicit access if req.user.role === 'admin' (adjust as per your role system)

    // The checkShopSubscription middleware (if you have one) would have already updated the status.
    // Or, you can re-check/update status here if needed, similar to getShopById.
    const now = new Date();
    let statusUpdated = false;
    if (shop.subscription.status === 'trial' && shop.subscription.trialEndDate && shop.subscription.trialEndDate < now) {
        shop.subscription.status = 'expired';
        shop.subscription.trialEndDate = undefined; // Clear trial end date
        statusUpdated = true;
    } else if (shop.subscription.status === 'active' && shop.subscription.lastPlanInfo && shop.subscription.lastPlanInfo.endDate && shop.subscription.lastPlanInfo.endDate < now) {
        shop.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await shop.save(); // Save if status was updated
    }


    res.json({
        success: true,
        data: shop.subscription,
    });
});


exports.serveRazorpayCheckoutPageShop = asyncHandler(async (req, res) => {
    const { order_id, key_id, amount, currency, name, description, prefill_email, prefill_contact, theme_color, shopId } = req.query;

    if (!order_id || !key_id || !amount || !currency || !name || !description || !shopId) {
        return res.status(400).send('Missing required parameters for checkout page.');
    }

    // Corrected: Add '/api' to the callback_url_base
    const callback_url_base = `${API_PUBLIC_URL}/api/shops/payment/webview-callback`; 

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
              "name": "${s(name)}", // Use name from query param
              "email": "${s(prefill_email)}",
              "contact": "${s(prefill_contact)}" // Use contact from query param
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


exports.createShopPaymentOrder = asyncHandler(async (req, res) => {
    const { amount, currency = 'INR', shopId, planId } = req.body; // planId is the Subscription ObjectId
    console.log("createShopPaymentOrder: Incoming request body:", req.body);

    // Step 1: Input Validation
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        console.error("createShopPaymentOrder: Validation Error - Invalid amount:", amount);
        throw new ApiError('A valid positive amount is required.', 400);
    }
    if (!shopId) {
        console.error("createShopPaymentOrder: Validation Error - Shop ID is missing.");
        throw new ApiError('Shop ID is required for creating an order record.', 400);
    }
    if (!planId) {
        console.error("createShopPaymentOrder: Validation Error - Subscription plan ID is missing.");
        throw new ApiError('Subscription plan ID is required.', 400);
    }
    console.log("createShopPaymentOrder: Input validation passed.");

    // Step 2: Verify shop ownership
    console.log(`createShopPaymentOrder: Verifying shop ownership for shopId: ${shopId} by owner: ${req.user._id}`);
    const shop = await Shop.findOne({ _id: shopId, owner: req.user._id });
    if (!shop) {
        console.error("createShopPaymentOrder: Authorization Error - Shop not found or not owned by user.");
        throw new ApiError('Shop not found or you are not the owner of this shop.', 404);
    }
    console.log("createShopPaymentOrder: Shop ownership verified. Shop details:", shop.name);

    // Step 3: Prepare Razorpay order options
    const amountInPaise = Math.round(amount * 100);
    console.log(`createShopPaymentOrder: Original amount: ${amount}, Amount in paise: ${amountInPaise}`);

    // Shorten the receipt for Razorpay's 40-character limit
    const shortShopId = shopId.slice(-10); // Take last 10 characters of shopId
    const shortTimestamp = Date.now().toString().slice(-6); // Take last 6 characters of timestamp
    const receiptValue = `rcpt_${shortShopId}_${shortTimestamp}`; // Example: rcpt_xxxxxxxxxx_yyyyyy

    const options = {
        amount: amountInPaise,
        currency,
        receipt: receiptValue, // Use the shortened receipt
        notes: {
            shopId: shopId,
            planId: planId,
            description: "Shop Subscription Payment"
        }
    };
    console.log("createShopPaymentOrder: Razorpay order options prepared:", options);

    // Step 4: Create order with Razorpay
    let order;
    try {
        console.log("createShopPaymentOrder: Attempting to create order with Razorpay...");
        order = await razorpayInstance.orders.create(options);
        console.log("createShopPaymentOrder: Razorpay order created successfully. Order ID:", order.id);
    } catch (razorpayError) {
        console.error("createShopPaymentOrder: Error creating Razorpay order:", razorpayError.message, razorpayError.error);
        // Log the full Razorpay error object for detailed debugging
        if (razorpayError.error) {
            console.error("Razorpay API Error Details:", JSON.stringify(razorpayError.error, null, 2));
        }
        throw new ApiError(`Razorpay order creation failed: ${razorpayError.message || 'Unknown error'}`, 500);
    }

    if (!order) {
        console.error("createShopPaymentOrder: Razorpay order object is null/undefined after creation attempt.");
        throw new ApiError("Razorpay order creation failed, order object is empty.", 500);
    }

    res.json({ success: true, data: order });
});


exports.verifyShopPaymentAndUpdateSubscription = asyncHandler(async (req, res) => {
    // const {
    //     razorpay_payment_id,
    //     razorpay_order_id,
    //     razorpay_signature,
    //     shopId,
    //     planId, // Subscription plan ID
    // } = req.body;

    // if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !shopId || !planId) {
    //     throw new ApiError('Missing required payment verification details.', 400);
    // }

    // const body_string = razorpay_order_id + '|' + razorpay_payment_id;
    // // Note: Razorpay's utility function might expect a specific format or object.
    // // Double-check documentation if this specific string concatenation is correct for `validateWebhookSignature`.
    // // Typically, it's `validateWebhookSignature(JSON.stringify(req.body), signatureFromHeader, secret)` for webhooks.
    // // For client-side verification like this, the string `order_id + '|' + payment_id` is common.
    // const isValidSignature = validateWebhookSignature(body_string, RAZORPAY_KEY_SECRET, razorpay_signature);
    //    try {
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


    if (!isValidSignature) {
        // Log details about the signature failure for debugging
        console.error('Payment Signature Validation Failed:');
        console.error('Expected signature (from Razorpay):', razorpay_signature);
        console.error('Calculated hash string:', body_string);
        // IMPORTANT: In production, AVOID logging your RAZORPAY_KEY_SECRET directly for security reasons.
        // For debugging, it can be useful, but remove it afterward.
        console.error('RAZORPAY_KEY_SECRET used (for debugging):', RAZORPAY_KEY_SECRET); 

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
    shop.subscription.trialEndDate = newSubscriptionEndDate; // Clear trial end date once active
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

// @desc    Get today's stats (earnings, customers) for a specific shop
// @route   GET /api/shops/:shopId/today-stats
// @access  Private (Owner, Admin)
exports.getShopTodayStats = asyncHandler(async (req, res) => {
    const { shopId } = req.params;

    // Verify shop and authorization
    const shop = await Shop.findById(shopId).select('owner');
    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }

    // Authorization: Only owner of the shop or Admin can view
    if (req.user.role === 'owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view stats for this shop.', 403);
    }
    // Admin user has implicit access if req.user.role === 'admin'

    // Calculate start and end of today in local time (or UTC if preferred, but usually local for "today")
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the beginning of today

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Set to the beginning of tomorrow

    // Aggregate history records for today
    const historyRecords = await History.find({
        shop: shopId,
        date: {
            $gte: today, // Greater than or equal to start of today
            $lt: tomorrow // Less than start of tomorrow
        }
    });

    let totalEarnings = 0;
    const uniqueCustomers = new Set();

    historyRecords.forEach(record => {
        totalEarnings += record.totalCost;
        if (record.user) { // Assuming `user` field stores the customer's ObjectId
            uniqueCustomers.add(record.user.toString());
        } else if (record.customerName) { // Fallback if `user` is not always present but `customerName` is
            uniqueCustomers.add(record.customerName);
        }
    });

    res.json({
        success: true,
        data: {
            earnings: totalEarnings,
            customers: uniqueCustomers.size,
        },
    });
});
// controllers/shopController.js
// ... (existing imports and utility functions)

// @desc    Get shop's coordinates by ID
// @route   GET /api/shops/:id/coordinates
// @access  Public
exports.getShopCoordinates = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shop = await Shop.findById(id).select('address.coordinates'); // Only select coordinates

    if (!shop) {
        throw new ApiError('Shop not found.', 404);
    }
    if (!shop.address || !shop.address.coordinates) {
        throw new ApiError('Shop coordinates not available.', 404);
    }

    res.json({
        success: true,
        data: shop.address.coordinates,
    });
});

// ... (rest of your existing shopController.js functions)