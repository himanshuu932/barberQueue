// controllers/queueController.js
const Queue = require('../models/Queue');
const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User'); // Ensure User model is imported
const Service = require('../models/Service');
const History = require('../models/History');
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateUniqueCode = require('../utils/generateCode');

const { Expo } = require('expo-server-sdk'); // Import Expo SDK

// This function will now accept the io instance
module.exports = (io) => {

    // Create a new Expo SDK client
    const expo = new Expo();

    // Helper to calculate total cost
    const calculateTotalCost = async (shopId, requestedServices) => {
        const shop = await Shop.findById(shopId).populate('services.service');
        if (!shop) {
            throw new ApiError('Shop not found', 404);
        }

        let total = 0;
        for (const reqService of requestedServices) {
            const shopService = shop.services.find(
                s => s.service._id.toString() === reqService.service.toString()
            );
            if (!shopService) {
                const genericService = await Service.findById(reqService.service);
                const serviceName = genericService ? genericService.name : 'Unknown Service';
                throw new ApiError(`Service "${serviceName}" is not offered by this shop.`, 400);
            }
            total += shopService.price * (reqService.quantity || 1);
        }
        return total;
    };

    // Helper to emit queue updates for a given shop
    const emitQueueUpdate = async (shopId) => {
        const updatedQueue = await Queue.find({ shop: shopId, status: { $in: ['pending', 'in-progress'] } })
                                        .populate('barber', 'name')
                                        .populate('userId', 'name')
                                        .populate('services.service', 'name')
                                        .sort({ orderOrQueueNumber: 1 });
        io.to(shopId.toString()).emit('queue:updated', updatedQueue);
        console.log(`Emitted queue:updated for shop ${shopId}`);
    };

    // @desc    Internal function to send push notification to a user
    //          Removed user.notification update as per request.
    const sendPushNotification = async (userID, title, body, data = {}) => {
        try {
            const user = await User.findById(userID);
            if (!user || !user.expopushtoken) {
                console.log(`Notification skipped for user ${userID}: Not found or no push token.`);
                return; // User not found or no push token, just return
            }

            if (!Expo.isExpoPushToken(user.expopushtoken)) {
                console.warn(`Invalid Expo push token for user ${userID}: ${user.expopushtoken}`);
                return; // Invalid token, just return
            }

            const message = {
                to: user.expopushtoken,
                sound: "default",
                title: title,
                body: body,
                channelId: "default",
                priority: "high",
                _displayInForeground: true,
                data: data,
            };

            let chunks = expo.chunkPushNotifications([message]);
            let tickets = [];
            for (let chunk of chunks) {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }
            console.log(`Notification sent to user ${userID}. Tickets:`, tickets);
            // In a real app, you'd store tickets and check receipts later.
        } catch (error) {
            console.error(`Error sending push notification to user ${userID}:`, error);
        }
    };


    // @desc    Add customer to queue
    // @route   POST /api/queue
    // @access  Public (can be by user or guest)
    const addToQueue = asyncHandler(async (req, res) => {
        const { shopId, barberId, services, customerName, customerPhone } = req.body;

        const shop = await Shop.findById(shopId);
        if (!shop) {
            throw new ApiError('Shop not found', 404);
        }

        let barber = null;
        if (barberId) {
            barber = await Barber.findById(barberId);
            if (!barber || barber.shopId.toString() !== shopId) {
                throw new ApiError('Barber not found in this shop', 404);
            }
            if (!barber.activeTaking) {
                throw new ApiError('Barber is currently not taking new customers', 400);
            }
        }

        let userId = null;
        let userName = customerName; // Default for guest
        if (req.user && req.userType === 'User') {
            userId = req.user._id;
            userName = req.user.name; // Use authenticated user's name
        } else if (!customerName || !customerPhone) {
            throw new ApiError('Customer name and phone are required for guest users.', 400);
        }

        const totalCost = await calculateTotalCost(shopId, services);

        const lastQueueEntry = await Queue.findOne({ shop: shopId, barber: barberId || null })
                                         .sort({ orderOrQueueNumber: -1 })
                                         .limit(1);
        const nextQueueNumber = lastQueueEntry ? lastQueueEntry.orderOrQueueNumber + 1 : 1;

        let uniqueCode;
        let codeExists = true;
        while(codeExists) {
            uniqueCode = generateUniqueCode();
            const existingCode = await Queue.findOne({ uniqueCode });
            codeExists = !!existingCode;
        }

        const queueEntry = await Queue.create({
            shop: shopId,
            barber: barberId,
            userId: userId,
            customerName: userId ? undefined : customerName,
            customerPhone: userId ? undefined : customerPhone,
            services: services,
            orderOrQueueNumber: nextQueueNumber,
            uniqueCode: uniqueCode,
            totalCost: totalCost,
            status: 'pending',
        });

        // --- Send Notification: User Added to Queue ---
        if (userId) { // Only send if it's a registered user
            const shopName = shop.name;
            const barberName = barber ? barber.name : 'Any Barber';
            const title = `You're in line at ${shopName}!`;
            const body = `Your queue number for ${barberName} is #${queueEntry.orderOrQueueNumber}. Unique code: ${queueEntry.uniqueCode}.`;
            const notificationData = {
                type: 'queue_add',
                queueId: queueEntry._id.toString(),
                shopId: shopId.toString(),
                barberId: barberId ? barberId.toString() : null,
                queueNumber: queueEntry.orderOrQueueNumber,
                uniqueCode: queueEntry.uniqueCode
            };
            await sendPushNotification(userId, title, body, notificationData);
        }
        // --- End Send Notification ---

        await emitQueueUpdate(shopId);

        res.status(201).json({
            success: true,
            message: 'Successfully added to queue',
            data: {
                _id: queueEntry._id,
                shop: shop.name,
                barber: barber ? barber.name : 'Any Barber',
                customer: userName,
                queueNumber: queueEntry.orderOrQueueNumber,
                uniqueCode: queueEntry.uniqueCode,
                totalCost: queueEntry.totalCost,
                expectedWaitTime: 'Calculation needed (based on active barbers, service duration, etc.)',
            },
        });
    });

    // @desc    Remove customer from queue (e.g., cancelled by user/barber)
    // @route   PUT /api/queue/:id/cancel
    // @access  Private (User, Barber, Owner, Admin)
    const removeFromQueue = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const queueEntry = await Queue.findById(id);

        if (!queueEntry) {
            throw new ApiError('Queue entry not found', 404);
        }

        if (req.userType === 'User' && queueEntry.userId && queueEntry.userId.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to cancel this queue entry.', 403);
        }
        if (req.userType === 'Barber' && queueEntry.barber && queueEntry.barber.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to cancel this queue entry (not your queue).', 403);
        }
        if (req.userType === 'Owner') {
            const shop = await Shop.findById(queueEntry.shop);
            if (!shop || shop.owner.toString() !== req.user._id.toString()) {
                throw new ApiError('Not authorized to cancel this queue entry (not your shop).', 403);
            }
        }

        queueEntry.status = 'cancelled';
        await queueEntry.save();

        // --- Send Notification: User Removed from Queue ---
        if (queueEntry.userId) { // Only send if it's a registered user
            const shop = await Shop.findById(queueEntry.shop); // Re-fetch shop for name
            const title = `Queue Update at ${shop ? shop.name : 'a shop'}`;
            const body = `Your queue entry #${queueEntry.orderOrQueueNumber} (Code: ${queueEntry.uniqueCode}) has been cancelled.`;
            const notificationData = {
                type: 'queue_cancelled',
                queueId: queueEntry._id.toString(),
                shopId: queueEntry.shop.toString(),
                uniqueCode: queueEntry.uniqueCode
            };
            await sendPushNotification(queueEntry.userId, title, body, notificationData);
        }
        // --- End Send Notification ---

        await emitQueueUpdate(queueEntry.shop);

        res.json({
            success: true,
            message: 'Queue entry cancelled successfully',
            data: queueEntry,
        });
    });

    // @desc    Update queue entry status (e.g., in-progress, completed)
    // @route   PUT /api/queue/:id/status
    // @access  Private (Barber, Owner, Admin)
    const updateQueueStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!['in-progress', 'completed'].includes(status)) {
            throw new ApiError('Invalid status provided. Must be "in-progress" or "completed".', 400);
        }

        const queueEntry = await Queue.findById(id)
                                      .populate('shop', 'owner')
                                      .populate('barber', 'shopId');

        if (!queueEntry) {
            throw new ApiError('Queue entry not found', 404);
        }

        if (req.userType === 'Barber' && queueEntry.barber && queueEntry.barber.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to update this queue entry (not your queue).', 403);
        }
        if (req.userType === 'Owner' && queueEntry.shop && queueEntry.shop.owner.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to update this queue entry (not your shop).', 403);
        }

        queueEntry.status = status;
        await queueEntry.save();

        if (status === 'completed') {
            const historyRecord = await History.create({
                user: queueEntry.userId,
                barber: queueEntry.barber,
                shop: queueEntry.shop._id,
                services: queueEntry.services,
                totalCost: queueEntry.totalCost,
                date: new Date(),
            });

            if (queueEntry.barber) {
                const barber = await Barber.findById(queueEntry.barber);
                if (barber) {
                    barber.customersServed += 1;
                    await barber.save();
                }
            }

            // --- Send Notification: Service Completed ---
            if (queueEntry.userId) { // Only send if it's a registered user
                const shop = await Shop.findById(queueEntry.shop._id);
                const barber = await Barber.findById(queueEntry.barber._id);
                const title = `Service Completed at ${shop ? shop.name : 'a shop'}!`;
                const body = `Your service with ${barber ? barber.name : 'a barber'} (Code: ${queueEntry.uniqueCode}) has been completed.`;
                const notificationData = {
                    type: 'service_completed',
                    queueId: queueEntry._id.toString(),
                    shopId: queueEntry.shop._id.toString(),
                    barberId: queueEntry.barber._id.toString(),
                    uniqueCode: queueEntry.uniqueCode
                };
                await sendPushNotification(queueEntry.userId, title, body, notificationData);
            }
            // --- End Send Notification ---

            res.json({
                success: true,
                message: 'Queue entry status updated to completed and history recorded.',
                data: { queueEntry, historyRecord },
            });
        } else if (status === 'in-progress') {
             // --- Send Notification: Service In Progress ---
            if (queueEntry.userId) { // Only send if it's a registered user
                const shop = await Shop.findById(queueEntry.shop._id);
                const barber = await Barber.findById(queueEntry.barber._id);
                const title = `You're up next at ${shop ? shop.name : 'a shop'}!`;
                const body = `${barber ? barber.name : 'Your barber'} is now ready for your service (Code: ${queueEntry.uniqueCode}).`;
                const notificationData = {
                    type: 'service_in_progress',
                    queueId: queueEntry._id.toString(),
                    shopId: queueEntry.shop._id.toString(),
                    barberId: queueEntry.barber._id.toString(),
                    uniqueCode: queueEntry.uniqueCode
                };
                await sendPushNotification(queueEntry.userId, title, body, notificationData);
            }
            // --- End Send Notification ---
            res.json({
                success: true,
                message: `Queue entry status updated to ${status}.`,
                data: queueEntry,
            });
        }


        await emitQueueUpdate(queueEntry.shop._id);
    });

    // @desc    Move a person down in queue by 1 position
    // @route   PUT /api/queue/:id/move-down
    // @access  Private (Barber, Owner, Admin)
    const movePersonDownInQueue = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const currentEntry = await Queue.findById(id);

        if (!currentEntry) {
            throw new ApiError('Queue entry not found', 404);
        }

        if (req.userType === 'Barber' && currentEntry.barber && currentEntry.barber.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to move this queue entry (not your queue).', 403);
        }
        if (req.userType === 'Owner') {
            const shop = await Shop.findById(currentEntry.shop);
            if (!shop || shop.owner.toString() !== req.user._id.toString()) {
                throw new ApiError('Not authorized to move this queue entry (not your shop).', 403);
            }
        }

        const nextEntry = await Queue.findOne({
            shop: currentEntry.shop,
            barber: currentEntry.barber,
            orderOrQueueNumber: currentEntry.orderOrQueueNumber + 1,
            status: { $in: ['pending', 'in-progress'] }
        });

        if (!nextEntry) {
            throw new ApiError('Cannot move down, already last in queue or no next person.', 400);
        }

        // Swap orderOrQueueNumber values
        const currentOrder = currentEntry.orderOrQueueNumber;
        currentEntry.orderOrQueueNumber = nextEntry.orderOrQueueNumber;
        nextEntry.orderOrQueueNumber = currentOrder;

        await currentEntry.save();
        await nextEntry.save();

        // --- Send Notification: Queue Position Changed ---
        if (currentEntry.userId) {
            const shop = await Shop.findById(currentEntry.shop);
            const title = `Queue Position Changed at ${shop ? shop.name : 'a shop'}`;
            const body = `Your queue entry (Code: ${currentEntry.uniqueCode}) is now #${currentEntry.orderOrQueueNumber}.`;
            const notificationData = {
                type: 'queue_position_change',
                queueId: currentEntry._id.toString(),
                shopId: currentEntry.shop.toString(),
                newPosition: currentEntry.orderOrQueueNumber,
                uniqueCode: currentEntry.uniqueCode
            };
            await sendPushNotification(currentEntry.userId, title, body, notificationData);
        }
        if (nextEntry.userId) { // Also notify the person who moved up
            const shop = await Shop.findById(nextEntry.shop);
            const title = `Queue Position Changed at ${shop ? shop.name : 'a shop'}`;
            const body = `Your queue entry (Code: ${nextEntry.uniqueCode}) is now #${nextEntry.orderOrQueueNumber}.`;
            const notificationData = {
                type: 'queue_position_change',
                queueId: nextEntry._id.toString(),
                shopId: nextEntry.shop.toString(),
                newPosition: nextEntry.orderOrQueueNumber,
                uniqueCode: nextEntry.uniqueCode
            };
            await sendPushNotification(nextEntry.userId, title, body, notificationData);
        }
        // --- End Send Notification ---

        await emitQueueUpdate(currentEntry.shop);

        res.json({
            success: true,
            message: `Queue entry ${currentEntry._id} moved down successfully.`,
            data: {
                movedEntry: currentEntry,
                swappedWithEntry: nextEntry,
            },
        });
    });


    // @desc    Get queue for a specific shop
    // @route   GET /api/shops/:shopId/queue
    // @access  Public (for display), Private (for management by Owner/Barber)
    const getShopQueue = asyncHandler(async (req, res) => {
        const { shopId } = req.params;

        const shop = await Shop.findById(shopId);
        if (!shop) {
            throw new ApiError('Shop not found', 404);
        }

        const queue = await Queue.find({ shop: shopId, status: { $in: ['pending', 'in-progress'] } })
                                 .populate('barber', 'name')
                                 .populate('userId', 'name')
                                 .populate('services.service', 'name')
                                 .sort({ orderOrQueueNumber: 1 });

        res.json({
            success: true,
            data: queue,
        });
    });

    // @desc    Get queue for a specific barber
    // @route   GET /api/barbers/:barberId/queue
    // @access  Public (for display), Private (for management by Barber/Owner)
    const getBarberQueue = asyncHandler(async (req, res) => {
        const { barberId } = req.params;

        const barber = await Barber.findById(barberId);
        if (!barber) {
            throw new ApiError('Barber not found', 404);
        }

        const queue = await Queue.find({ barber: barberId, status: { $in: ['pending', 'in-progress'] } })
                                 .populate('shop', 'name')
                                 .populate('userId', 'name')
                                 .populate('services.service', 'name')
                                 .sort({ orderOrQueueNumber: 1 });

        res.json({
            success: true,
            data: queue,
        });
    });

    return {
        addToQueue,
        removeFromQueue,
        updateQueueStatus,
        movePersonDownInQueue,
        getShopQueue,
        getBarberQueue,
        // sendPushNotification is now an internal helper, not exported via API
    };
};
