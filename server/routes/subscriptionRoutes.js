// routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for subscription plans
router.get('/', subscriptionController.getAllSubscriptionPlans);
router.get('/:id', subscriptionController.getSubscriptionPlanById);

// Private routes for subscription plan management (Admin only)
router.post('/',  protect(['admin']), authorize('admin'), subscriptionController.createSubscriptionPlan);
router.put('/:id', protect(['admin']), authorize('admin'), subscriptionController.updateSubscriptionPlan);
router.delete('/:id', protect(['admin']), authorize('admin'), subscriptionController.deleteSubscriptionPlan);

module.exports = router;
