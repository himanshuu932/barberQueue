// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for admin authentication (initial setup)
router.post('/register', adminController.registerAdmin); // Consider restricting this after initial setup
router.post('/login', adminController.adminLogin);

// Private routes for authenticated admins
router.get('/profile', protect(['admin']), authorize('admin'), adminController.getAdminProfile);
router.put('/profile', protect(['admin']), authorize('admin'), adminController.updateAdminProfile);

// Admin management of Users
router.get('/users', protect(['admin']), authorize('admin'), adminController.getUsers);
router.delete('/users/:id', protect(['admin']), authorize('admin'), adminController.deleteUser);
// Add routes for update user status etc. if needed

// Admin management of Owners
router.get('/owners', protect(['admin']), authorize('admin'), adminController.getOwners);
// Add routes for update owner status, delete owner etc. if needed

// Admin management of Shops
router.get('/shops', protect(['admin']), authorize('admin'), adminController.getShops);
router.delete('/shops/:id', protect(['admin']), authorize('admin'), adminController.deleteShop);
// Add routes for update shop status etc. if needed

// Admin management of Barbers
router.get('/barbers', protect(['admin']), authorize('admin'), adminController.getBarbers);
// Add routes for update barber status, delete barber etc. if needed

// System Analytics
router.get('/analytics', protect(['admin']), authorize('admin'), adminController.getSystemAnalytics);

module.exports = router;
