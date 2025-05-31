// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, checkUserSubscription } = require('../middleware/authMiddleware');

// Public routes for user authentication
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Private routes for authenticated users
router.get('/profile', protect(['user']), userController.getUserProfile);
router.put('/profile', protect(['user']), userController.updateUserProfile);
router.delete('/me', protect(['user']), userController.deleteUserAccount); // Delete own account

// Pinned Shop functionality
router.put('/pin-shop/:shopId', protect(['user']), userController.pinShop);
router.put('/unpin-shop', protect(['user']), userController.unpinShop);

// User Subscription status (checked by middleware on relevant routes)
router.get('/subscription-status', protect(['user']), checkUserSubscription, userController.getUserSubscriptionStatus);

// Razorpay Payment Routes for Users
router.post('/payment/create-order', protect(['user']), userController.createUserPaymentOrder);
router.post('/payment/verify', protect(['user']), userController.verifyUserPaymentAndUpdateSubscription);

// Webview callback endpoints (Razorpay redirects here)
router.get('/payment/webview-callback/success', userController.handleWebViewCallbackSuccessUser);
router.get('/payment/webview-callback/failure', userController.handleWebViewCallbackFailureUser);
router.get('/payment/checkout-page', protect(['user']), userController.serveRazorpayCheckoutPageUser); // Protected as it uses req.user data

module.exports = router;
