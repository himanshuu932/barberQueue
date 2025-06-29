// routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for owner authentication
router.post('/register', ownerController.registerOwner);
router.post('/login', ownerController.loginOwner);

//change password
router.post('/change-password/initiate',  protect(['owner']), ownerController.initiatePasswordChange);
router.post('/change-password/confirm', protect(['owner']), ownerController.confirmPasswordChange);

router.post('/forgot-password', ownerController.initiatePasswordReset);
router.post('/reset-password', ownerController.resetPassword);


// Private routes for authenticated owners
router.get('/profile', protect(['owner']), ownerController.getOwnerProfile);
router.put('/profile', protect(['owner']), ownerController.updateOwnerProfile);
router.get('/me/shops', protect(['owner']), ownerController.getOwnerShops);

module.exports = router;
