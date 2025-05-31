// routes/queueRoutes.js
const express = require('express');
const { protect, authorize, checkUserSubscription, checkShopSubscription } = require('../middleware/authMiddleware');

module.exports = (io) => {
    const router = express.Router();
    // Pass io to the controller functions
    const queueController = require('../controllers/queueController')(io);

    // Public route for adding to queue (can be by guest or logged-in user)
    router.post('/', queueController.addToQueue);

    // Public routes for viewing queues (e.g., for display in shop)
    router.get('/shop/:shopId', queueController.getShopQueue);
    router.get('/barber/:barberId', queueController.getBarberQueue);

    // Private routes for queue management (User, Barber, Owner, Admin)
    router.put('/:id/cancel', protect(['user', 'barber', 'owner', 'admin']), queueController.removeFromQueue);
    router.put('/:id/status', protect(['barber', 'owner', 'admin']), queueController.updateQueueStatus); // Status updates often by barber/owner

    // Route to move a person down in queue
    router.put('/:id/move-down', protect(['barber', 'owner', 'admin']), queueController.movePersonDownInQueue);

    // Removed the explicit route for sendPushNotification as it's now an internal helper
    // If you need an API endpoint to trigger arbitrary notifications, you'd add it here
    // e.g., router.post('/send-notification', protect(['admin']), queueController.sendPushNotification);

    return router;
};
