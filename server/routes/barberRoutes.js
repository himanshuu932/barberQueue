// routes/barberRoutes.js
const express = require('express');
const router = express.Router();
const barberController = require('../controllers/barberController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes for barber information
router.post('/login', barberController.authBarber);
router.post('/register-push-token', protect(['barber', 'owner', 'user']), barberController.registerPushToken); // ADD THIS LINE: This route saves the token for any authenticated user type
router.get('/:id', barberController.getBarberById);
router.get('/:id/customers-served', barberController.getBarberCustomersServed);
router.get('/shop/:shopId', barberController.getBarbersByShop); // Get barbers for a specific shop

// Private routes for barber management (Owner only)
router.post('/', protect(['owner']), authorize('owner'), barberController.createBarber);
router.put('/:id', protect(['owner', 'barber']), barberController.updateBarberDetails); // Owner can update any barber in their shop, Barber can update self
router.delete('/:id', protect(['owner']), authorize('owner'), barberController.deleteBarber);
router.put('/:id/toggle-active', protect(['owner', 'barber']), barberController.updateBarberActiveStatus); // Owner can toggle any, Barber can toggle self
router.put('/rate/:id',protect(['user']), barberController.rate);
module.exports = router;