// routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for owner authentication
router.post('/register', ownerController.registerOwner);
router.post('/login', ownerController.loginOwner);

// Private routes for authenticated owners
router.get('/profile', protect(['owner']), ownerController.getOwnerProfile);
router.put('/profile', protect(['owner']), ownerController.updateOwnerProfile);
router.get('/me/shops', protect(['owner']), ownerController.getOwnerShops);

module.exports = router;
