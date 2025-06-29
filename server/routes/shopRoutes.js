// routes/shopRoutes.js
const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { protect, authorize, checkShopSubscription } = require('../middleware/authMiddleware');

// Public routes for shop information
router.get('/',(req,res,next)=>{console.log("reached in backend of getting all shop for owner"), next();} ,shopController.getAllShops); // Get all shops (for discovery)
router.get('/:id', shopController.getShopById); // Get specific shop details
router.get('/:id/rate-list', shopController.getShopRateList); // Get shop's services and prices
router.get('/:id/coordinates', shopController.getShopCoordinates); // NEW: Get shop's coordinates

// Private routes for shop management (Owner only, with subscription check)
router.post('/', protect(['owner']), authorize('owner'), shopController.createShop); // Create new shop
router.put('/:id', protect(['owner']), authorize('owner'), shopController.updateShopDetails);
router.delete('/:id', protect(['owner']), authorize('owner'), shopController.deleteShop);

// Shop Services management (Owner only, with subscription check)
router.post('/:id/services', protect(['owner']), authorize('owner'), checkShopSubscription, shopController.addService);
router.put('/:id/services/:serviceItemId', protect(['owner']), authorize('owner'), checkShopSubscription, shopController.updateShopServicePrice);
router.delete('/:id/services/:serviceItemId', protect(['owner']), authorize('owner'), checkShopSubscription, shopController.removeServiceFromShop);


//Shop photo upload and delete fro owner 
router.post('/:id/photos',(req,res,next)=>{console.log("reached here"); next();}, protect(['owner']), authorize('owner'), checkShopSubscription,  shopController.uploadShopPhotos);
router.delete('/:id/photos/:photoId(*)', protect(['owner']), authorize('owner'), checkShopSubscription, shopController.deleteShopPhoto);



// Shop Subscription status (Owner/Admin only)
router.get('/:id/subscription-status', protect(['owner', 'admin']), shopController.getShopSubscriptionStatus);

// Razorpay Payment Routes for Shops (Owner only)
router.post('/payment/create-order', protect(['owner']), authorize('owner'), shopController.createShopPaymentOrder);
router.post('/payment/verify', protect(['owner']), authorize('owner'), shopController.verifyShopPaymentAndUpdateSubscription);

// Webview callback endpoints (Razorpay redirects here)
router.get('/payment/webview-callback/success', shopController.handleWebViewCallbackSuccessShop);
router.get('/payment/webview-callback/failure', shopController.handleWebViewCallbackFailureShop);
router.get('/payment/checkout-page', shopController.serveRazorpayCheckoutPageShop); // Protected as it uses req.user data

module.exports = router;