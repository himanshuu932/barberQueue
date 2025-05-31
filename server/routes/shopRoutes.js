const express = require('express');
const router = express.Router();

// Import controllers
const {
  // Auth
  signup,
  login,
  // Profile
  getProfile,
  updateProfile,
  // Address & Coordinates
  updateAddress, // Can be merged into updateProfile or kept separate
  getCoordinates,
  // Push Notifications
  registerForPushNotifications,
  // Shop Listing
  getAllShops,
  // Rate List
  getRateList,
  addRateListItem,
  updateRateListItem,
  deleteRateListItem,
  // History (Placeholders)
  getHistoryByDate,
  getAllHistory,
  // Payment
  serveRazorpayCheckoutPage,
  createPaymentOrder,
  verifyPaymentAndUpdateTrial,
  handleWebViewCallbackSuccess,
  handleWebViewCallbackFailure
} = require('../controllers/shopControllers'); // Adjust path if necessary

// --- Authentication Routes ---
router.post('/signup', signup);
router.post('/login', login);

// --- Profile Routes ---
// Note: For routes like /profile, /profile/update, consider using a middleware
// to extract shopId from JWT token (req.user.id) instead of passing shopId in query/body.
// For now, assuming shopId is passed as needed.
router.get('/profile', getProfile); // e.g., /shop/profile?id=xxxx
router.patch('/profile/update', updateProfile); // PATCH for partial updates

// --- Address & Coordinates ---
router.post('/update-address', updateAddress); // Could be PATCH /profile with address data
router.get('/coordinates', getCoordinates); // e.g., /shop/coordinates?id=xxxx

// --- Push Notification Token ---
router.post('/register-push-token', registerForPushNotifications);

// --- Shop Listing ---
router.get('/shops', getAllShops); // Public or admin-only listing

// --- Rate List CRUD Routes ---
// These routes might be better as /shops/:shopId/ratelist if shopId isn't from JWT
router.get('/rateList', getRateList);            // Query: ?id=shopId
router.post('/rateList/add', addRateListItem);    // Body: { shopId, service, price }
router.put('/rateList/update', updateRateListItem); // Body: { shopId, rateItemId, service, price }
// For DELETE, params are often preferred: router.delete('/rateList/:shopId/:rateItemId', deleteRateListItem);
router.delete('/rateList/delete', deleteRateListItem); // Body: { shopId, rateItemId }

// --- History Routes (Placeholders) ---
router.get('/history/:date', getHistoryByDate); // Query: ?id=shopId, Param: date
router.get('/history', getAllHistory);          // Query: ?id=shopId


router.post('/payment/create-order', createPaymentOrder);
router.post('/payment/verify', verifyPaymentAndUpdateTrial);
router.get('/payment/checkout-page', serveRazorpayCheckoutPage); // New
router.get('/payment/webview-callback/success', handleWebViewCallbackSuccess); // New
router.get('/payment/webview-callback/failure', handleWebViewCallbackFailure); // New
module.exports = router;