// controllers/queueController.js
const Queue = require('../models/Queue');
const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const User = require('../models/User');
const History = require('../models/History');
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateUniqueCode = require('../utils/generateCode'); // Ensure this utility exists and works
const { Expo } = require('expo-server-sdk');

module.exports = (io) => {
    const expo = new Expo();

    // --- Internal Helper: Send Push Notification ---
    const sendPushNotification = async (userID, title, body, data = {}) => {
        try {
            const user = await User.findById(userID);
            if (!user || !user.expopushtoken) {
                console.log(`Notification skipped for user ${userID}: Not found or no push token.`);
                return;
            }

            if (!Expo.isExpoPushToken(user.expopushtoken)) {
                console.warn(`Invalid Expo push token for user ${userID}: ${user.expopushtoken}`);
                return;
            }

            const message = {
                to: user.expopushtoken,
                sound: "default",
                title: title,
                body: body,
                channelId: "default", // Ensure this channel exists on the client
                priority: "high",
                data: data,
            };

            // Expo SDK handles chunking and sending
            await expo.sendPushNotificationsAsync([message]);
            console.log(`Notification sent to user ${userID}. Title: ${title}`);
        } catch (error) {
            console.error(`Error sending push notification to user ${userID}:`, error);
        }
    };

    // --- Internal Helper: Emit Queue Updates via Socket.IO ---
    const emitQueueUpdate = async (shopId) => {
        if (!shopId) return;
        try {
            const updatedQueue = await Queue.find({ shop: shopId, status: { $in: ['pending', 'in-progress'] } })
                                            .populate('barber', 'name')
                                            .populate('userId', 'name') // Populates name if userId is present
                                            .sort({ orderOrQueueNumber: 1 });
            io.to(shopId.toString()).emit('queue:updated', {
                shopId: shopId,
                queue: updatedQueue,
                count: updatedQueue.length
            });
            console.log(`Emitted queue:updated for shop ${shopId} with ${updatedQueue.length} items.`);
        } catch (error) {
            console.error(`Error emitting queue update for shop ${shopId}:`, error);
        }
    };

    // @desc    Add customer to queue
    // @route   POST /api/queue
    // @access  Public
const addToQueue = asyncHandler(async (req, res) => {
  const {
    shopId,
    services: requestedServicesInput,
    userIdFromFrontend,
    customerName: nameFromRequest
  } = req.body;

  // Barber and phone are always null in this flow
  const barberId = null;
 const customerPhone = req.body.customerPhone || null;


  console.log('Incoming payload:', JSON.stringify(req.body));

  // 1. Find the shop (no populate, since services are embedded)
  const shop = await Shop.findById(shopId);
  if (!shop) {
    console.error(`Shop not found (ID: ${shopId})`);
    throw new ApiError('Shop not found', 404);
  }

  // 2. Barber is always null here
  let barber = null;

  // 3. Determine user (JWT first, then frontend ID, then guest name)
  let userIdToSave = null;
  let actualCustomerName = nameFromRequest;
  let userToNotify = null;

  if (req.user && req.userType === 'User') {
    userIdToSave = req.user._id;
    actualCustomerName = req.user.name;
    userToNotify = req.user._id;
  } else if (userIdFromFrontend) {
    const userExists = await User.findById(userIdFromFrontend);
    if (userExists) {
      userIdToSave = userExists._id;
      actualCustomerName = userExists.name;
      userToNotify = userExists._id;
    } else {
      if (!nameFromRequest) {
        console.error(
          `Invalid userIdFromFrontend (${userIdFromFrontend}) and no customerName provided`
        );
        throw new ApiError('Customer name is required for guest users.', 400);
      }
      // actualCustomerName remains nameFromRequest
    }
  } else if (!nameFromRequest) {
    console.error('Pure guest request without customerName');
    throw new ApiError('Customer name is required.', 400);
  }
  // If pure guest, actualCustomerName is already nameFromRequest

  // 4. Validate services array
  if (
    !requestedServicesInput ||
    !Array.isArray(requestedServicesInput) ||
    requestedServicesInput.length === 0
  ) {
    console.error('No services array or empty services passed');
    throw new ApiError('At least one service must be selected.', 400);
  }

  // 5. Build `servicesForQueueSchema` from embedded shop.services
  let totalCost = 0;
  const servicesForQueueSchema = [];

  for (const reqService of requestedServicesInput) {
    // reqService = { service: "<subdocId>", quantity: X }
    const shopServiceEntry = shop.services.find(
      (s) => s._id.toString() === reqService.service.toString()
    );

    if (!shopServiceEntry) {
      console.error(
        `Service with ID "${reqService.service}" not found in shop ${shopId}`
      );
      throw new ApiError(
        `Service with ID "${reqService.service}" is not offered or is invalid.`,
        400
      );
    }

    const priceForThisService = shopServiceEntry.price;
    const nameForThisService = shopServiceEntry.name;
    const quantity = Math.max(1, parseInt(reqService.quantity, 10) || 1);

    for (let i = 0; i < quantity; i++) {
      servicesForQueueSchema.push({
        name: nameForThisService,
        price: priceForThisService
      });
    }
    totalCost += priceForThisService * quantity;
  }

  // 6. Determine next queue number
  const lastQueueEntry = await Queue.findOne({
    shop: shop._id,
    barber: null,
    status: { $in: ['pending', 'in-progress'] }
  }).sort({ orderOrQueueNumber: -1 });

  const nextQueueNumber = lastQueueEntry
    ? lastQueueEntry.orderOrQueueNumber + 1
    : 1;

  // 7. Generate a truly unique code
  let uniqueCode;
  do {
    uniqueCode = generateUniqueCode();
  } while (await Queue.findOne({ uniqueCode }));

  // 8. Create the queue entry
  const queueEntry = await Queue.create({
    shop: shop._id,
    barber: null,
    userId: userIdToSave,
    customerName: userIdToSave ? undefined : actualCustomerName,
    customerPhone: userIdToSave ? undefined : customerPhone,
    services: servicesForQueueSchema,
    orderOrQueueNumber: nextQueueNumber,
    uniqueCode: uniqueCode,
    totalCost: totalCost,
    status: 'pending'
  });

  // 9. Optional push notification
  if (userToNotify) {
    const title = `You're in line at ${shop.name}!`;
    const body = `Your queue number is #${queueEntry.orderOrQueueNumber}. Code: ${queueEntry.uniqueCode}.`;
    await sendPushNotification(userToNotify, title, body, {
      type: 'queue_add',
      queueId: queueEntry._id.toString()
    });
  }

  // 10. Emit socket update
  await emitQueueUpdate(shop._id.toString());

  // 11. Send JSON response
  res.status(201).json({
    success: true,
    message: 'Successfully added to queue.',
    data: {
      _id: queueEntry._id,
      shop: { _id: shop._id, name: shop.name },
      barber: null,
      user: userIdToSave
        ? { _id: userIdToSave, name: actualCustomerName }
        : null,
      customerName: queueEntry.customerName,
      orderOrQueueNumber: queueEntry.orderOrQueueNumber,
      uniqueCode: queueEntry.uniqueCode,
      totalCost: queueEntry.totalCost,
      services: queueEntry.services,
      status: queueEntry.status,
      createdAt: queueEntry.createdAt
    }
  });
});

// @desc    Add walk-in customer to queue (Barber-specific)
// @route   POST /api/queue/walkin
// @access  Private (Barber, Owner, Admin)
const addWalkInToQueue = asyncHandler(async (req, res) => {
  console.log("reached to walking");
    const { shopId, customerName, services: requestedServicesInput } = req.body;

    // 1. Validate required fields
    if (!shopId || !customerName || !requestedServicesInput) {
        throw new ApiError('Shop ID, customer name, and services are required', 400);
    }

    // 2. Find the shop
    const shop = await Shop.findById(shopId);
    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }

    // 3. Validate services array
    if (!Array.isArray(requestedServicesInput)) {
        throw new ApiError('Services must be an array', 400);
    }

    // 4. Build services array and calculate total cost
    let totalCost = 0;
    const servicesForQueueSchema = [];

    for (const reqService of requestedServicesInput) {
        const shopServiceEntry = shop.services.find(
            s => s._id.toString() === reqService.service.toString()
        );

        if (!shopServiceEntry) {
            throw new ApiError(`Service with ID "${reqService.service}" not found`, 400);
        }

        const quantity = Math.max(1, parseInt(reqService.quantity, 10) || 1);
        
        servicesForQueueSchema.push({
            name: shopServiceEntry.name,
            price: shopServiceEntry.price
        });
        
        totalCost += shopServiceEntry.price * quantity;
    }

    // 5. Determine next queue number
    const lastQueueEntry = await Queue.findOne({
        shop: shop._id,
        barber: null,
        status: { $in: ['pending', 'in-progress'] }
    }).sort({ orderOrQueueNumber: -1 });

    const nextQueueNumber = lastQueueEntry ? lastQueueEntry.orderOrQueueNumber + 1 : 1;

    // 6. Generate unique code
    let uniqueCode;
    do {
        uniqueCode = generateUniqueCode();
    } while (await Queue.findOne({ uniqueCode }));

    // 7. Create the queue entry
    const queueEntry = await Queue.create({
        shop: shop._id,
        barber: req.userType === 'Barber' ? req.user._id : null,
        customerName: customerName,
        customerPhone: req.body.customerPhone || null,
        services: servicesForQueueSchema,
        orderOrQueueNumber: nextQueueNumber,
        uniqueCode: uniqueCode,
        totalCost: totalCost,
        status: 'pending'
    });

    // 8. Emit socket update
    await emitQueueUpdate(shop._id.toString());

    res.status(201).json({
        success: true,
        message: 'Walk-in customer added to queue successfully.',
        data: {
            _id: queueEntry._id,
            shop: { _id: shop._id, name: shop.name },
            barber: req.userType === 'Barber' ? { _id: req.user._id, name: req.user.name } : null,
            customerName: queueEntry.customerName,
            orderOrQueueNumber: queueEntry.orderOrQueueNumber,
            uniqueCode: queueEntry.uniqueCode,
            totalCost: queueEntry.totalCost,
            services: queueEntry.services,
            status: queueEntry.status,
            createdAt: queueEntry.createdAt
        }
    });
});




    // @desc    Remove/Cancel customer from queue
    // @route   PUT /api/queue/:id/cancel
    // @access  Private (User, Barber, Owner, Admin - adjust protect() middleware accordingly)
const removeFromQueue = asyncHandler(async (req, res, next) => {
  try {
    // 1. Log the incoming queue ID
    const { id } = req.params;
    console.log(`removeFromQueue called with id: ${id}`);

    // 2. Find the queue entry (populate shop name for notifications)
    const queueEntry = await Queue.findById(id).populate('shop', '_id name');
    if (!queueEntry) {
      console.error(`Queue entry not found (ID: ${id})`);
      throw new ApiError('Queue entry not found', 404);
    }

    console.log(
      `Found queueEntry: shop=${queueEntry.shop.name}, status=${queueEntry.status}, userId=${queueEntry.userId}`
    );

    // 3. (Optional) Authorization logic placeholder
    // Example:
    // if (req.userType === 'User' && queueEntry.userId.toString() !== req.user._id.toString()) {
    //   console.error(`User ${req.user._id} unauthorized to cancel queue ${id}`);
    //   throw new ApiError('Not authorized to cancel this queue entry', 403);
    // }
    // if (req.userType === 'Barber' && queueEntry.barber && queueEntry.barber.toString() !== req.user._id.toString()) {
    //   console.error(`Barber ${req.user._id} unauthorized to cancel queue ${id}`);
    //   throw new ApiError('Not authorized to cancel this queue entry', 403);
    // }

    // 4. Check current status
    if (queueEntry.status === 'completed' || queueEntry.status === 'cancelled') {
      console.error(
        `Queue entry ${id} already in status=${queueEntry.status}, cannot cancel`
      );
      throw new ApiError(`Queue entry is already ${queueEntry.status}.`, 400);
    }

    // 5. Update status to 'cancelled'
    console.log(`Cancelling queue entry ${id} (prev status=${queueEntry.status})`);
    queueEntry.status = 'cancelled';
    await queueEntry.save();

    // Reorder remaining queue
const remainingQueue = await Queue.find({
  shop: queueEntry.shop._id,
  status: { $in: ['pending', 'in-progress'] }
}).sort({ orderOrQueueNumber: 1 });

for (let i = 0; i < remainingQueue.length; i++) {
  remainingQueue[i].orderOrQueueNumber = i + 1;
  await remainingQueue[i].save();
}
    console.log(`Queue entry ${id} status updated to 'cancelled'`);

    // 6. Send push notification if there's an associated user
    if (queueEntry.userId) {
      const title = `Queue Update at ${queueEntry.shop.name}`;
      const body = `Your queue entry #${queueEntry.orderOrQueueNumber} (Code: ${queueEntry.uniqueCode}) has been cancelled.`;
      console.log(
        `Sending push notification to user ${queueEntry.userId} for cancellation of queue ${id}`
      );
      await sendPushNotification(queueEntry.userId, title, body, {
        type: 'queue_cancelled',
        queueId: id
      });
    } else {
      console.log(`No userId to notify for queue entry ${id}`);
    }

    // 7. Emit real-time update for shop listeners
    console.log(`Emitting queue update for shop ${queueEntry.shop._id}`);
    await emitQueueUpdate(queueEntry.shop._id.toString());

    // 8. Return JSON response
    res.json({
      success: true,
      message: 'Queue entry cancelled successfully',
      data: queueEntry
    });
    console.log(`removeFromQueue completed for id: ${id}`);
  } catch (err) {
    // 9. Log the error stack/message
    console.error('Error in removeFromQueue:', err);
    // Rethrow so asyncHandler/Express error middleware handles it
    throw err;
  }
});


    // @desc    Update queue entry status (e.g., in-progress, completed)
    // @route   PUT /api/queue/:id/status
    // @access  Private (Barber, Owner, Admin)
const updateQueueStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body; // Expect "in-progress" or "completed"

        if (!['in-progress', 'completed'].includes(status)) {
            throw new ApiError('Invalid status. Must be "in-progress" or "completed".', 400);
        }

        const queueEntry = await Queue.findById(id).populate('shop', '_id name owner').populate('barber', '_id name shopId');

        if (!queueEntry) {
            throw new ApiError('Queue entry not found', 404);
        }
        
        const oldStatus = queueEntry.status;
        queueEntry.status = status;

        if (status === 'completed' && oldStatus !== 'completed') {
            await History.create({
                user: queueEntry.userId,
                barber: queueEntry.barber ? queueEntry.barber._id : null,
                shop: queueEntry.shop._id,
                services: queueEntry.services,
                totalCost: queueEntry.totalCost,
                date: new Date(),
                uniqueCode: queueEntry.uniqueCode,
                orderOrQueueNumber: queueEntry.orderOrQueueNumber
            });

            if (queueEntry.barber) {
                await Barber.findByIdAndUpdate(queueEntry.barber._id, { $inc: { customersServed: 1 } });
            }
             // Update shop's total customers served or revenue if tracked
        }
        await queueEntry.save();

        if (queueEntry.userId) {
            const shopName = queueEntry.shop.name;
            const barberName = queueEntry.barber ? queueEntry.barber.name : 'The barber';
            let title = '';
            let body = '';

            if (status === 'in-progress') {
                title = `You're up next at ${shopName}!`;
                body = `${barberName} is now ready for you (Code: ${queueEntry.uniqueCode}).`;
            } else if (status === 'completed') {
                title = `Service Completed at ${shopName}!`;
                body = `Your service with ${barberName} (Code: ${queueEntry.uniqueCode}) is complete. Thank you!`;
                // TODO: Trigger rating prompt? -> client-side logic post-completion
            }
            if (title) {
                 await sendPushNotification(queueEntry.userId, title, body, { type: `service_${status.replace('-', '_')}`, queueId: id });
            }
        }

        await emitQueueUpdate(queueEntry.shop._id.toString());
        res.json({ success: true, message: `Queue entry status updated to ${status}.`, data: queueEntry });
    });

    // @desc    Get queue for a specific shop
    // @route   GET /api/queue/shop/:shopId
    // @access  Public
    const getShopQueue = asyncHandler(async (req, res) => {
        const { shopId } = req.params;
        if (!shopId.match(/^[0-9a-fA-F]{24}$/)) { // Validate if shopId is a valid ObjectId
            throw new ApiError('Invalid Shop ID format', 400);
        }
        const shopExists = await Shop.findById(shopId);
        if (!shopExists) {
            throw new ApiError('Shop not found', 404);
        }

        const queue = await Queue.find({ shop: shopId, status: { $in: ['pending', 'in-progress'] } })
                                 .populate('barber', 'name')
                                 .populate('userId', 'name email') // Send more user details if needed by client
                                 .sort({ orderOrQueueNumber: 1 });
        res.json({
            success: true,
            count: queue.length,
            data: queue,
        });
    });

    // @desc    Get queue for a specific barber
    // @route   GET /api/queue/barber/:barberId
    // @access  Public (or Private if only barber can see their own)
     const getBarberQueue = asyncHandler(async (req, res) => {
        const { barberId } = req.params;
        if (!barberId.match(/^[0-9a-fA-F]{24}$/)) {
            throw new ApiError('Invalid Barber ID format', 400);
        }
        const barber = await Barber.findById(barberId);
        if (!barber) {
            throw new ApiError('Barber not found', 404);
        }

        const queue = await Queue.find({ barber: barberId, status: { $in: ['pending', 'in-progress'] } })
                                 .populate('shop', 'name')
                                 .populate('userId', 'name')
                                 .sort({ orderOrQueueNumber: 1 });
        res.json({ success: true, count: queue.length, data: queue });
    });

    // --- TODO: Implement other queue management functions as needed ---
    // - movePersonDownInQueue
    // - updateServicesInQueue (if a user wants to change services while waiting)
    //   This would be a PATCH /api/queue/:id/services
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
    orderOrQueueNumber: { $gt: currentEntry.orderOrQueueNumber },
    status: { $in: ['pending', 'in-progress'] }
}).sort({ orderOrQueueNumber: 1 });


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
    return {
        addToQueue,
        addWalkInToQueue,
        removeFromQueue,
        updateQueueStatus,
        getShopQueue,
        getBarberQueue,
         movePersonDownInQueue,
    };
};