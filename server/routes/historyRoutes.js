// routes/historyRoutes.js
const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Private routes for history retrieval
router.post('/', protect(['admin']), authorize('admin'), historyController.createHistoryRecord); // Primarily for internal/admin use
router.get('/user/:userId', protect(['user', 'admin']), historyController.getUserHistory); // User gets own, Admin gets any
router.get('/me', protect(['user', 'barber']), historyController.getUserHistory); // Shortcut for logged-in user/barber to get their own history
router.get('/barber/:barberId', protect(['barber', 'owner', 'admin']), historyController.getBarberHistory); // Barber gets own, Owner gets shop's barbers, Admin gets any
router.get('/shop/:shopId', protect(['owner', 'admin']), historyController.getShopHistory); // Owner gets own shop's, Admin gets any

module.exports = router;
