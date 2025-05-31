// routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for generic services
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

// Private routes for generic service management (Admin only)
router.post('/', protect(['admin']), authorize('admin'), serviceController.createService);
router.put('/:id', protect(['admin']), authorize('admin'), serviceController.updateService);
router.delete('/:id', protect(['admin']), authorize('admin'), serviceController.deleteService);

module.exports = router;
