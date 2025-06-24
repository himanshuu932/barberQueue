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

            const pushToken = user.expopushtoken;
            console.log(`Attempting to send push notification to user ${userID} with token: ${pushToken}`);

            if (!Expo.isExpoPushToken(pushToken)) {
                console.warn(`Invalid Expo push token for user ${userID}: ${pushToken}`);
                return;
            }

            const message = {
                to: pushToken,
                sound: "default",
                title: title,
                body: body,
                channelId: "default", // Ensure this channel exists on the client
                priority: "high",
                data: data,
            };

            // Expo SDK handles chunking and sending
            const tickets = await expo.sendPushNotificationsAsync([message]);
            console.log(`Push notification sent successfully to user ${userID}. Tickets:`, tickets);
            // You might want to store these tickets to check receipts later for delivery status
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
        
        // Push each service instance separately based on quantity
        for (let i = 0; i < quantity; i++) {
            servicesForQueueSchema.push({
                name: shopServiceEntry.name,
                price: shopServiceEntry.price
            });
        }
        
        totalCost += shopServiceEntry.price * quantity;
    }

    // 5. Determine next queue number - FIXED: Include barber-specific queues
    const lastQueueEntry = await Queue.findOne({
        shop: shop._id,
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
        const { id } = req.params;
        const queueEntry = await Queue.findById(id).populate('shop', '_id name');

        if (!queueEntry) {
            throw new ApiError('Queue entry not found', 404);
        }

        if (queueEntry.status === 'completed' || queueEntry.status === 'cancelled') {
            throw new ApiError(`Queue entry is already ${queueEntry.status}.`, 400);
        }

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

        // Send notification to the removed user
        if (queueEntry.userId) {
            await sendPushNotification(
                queueEntry.userId,
                `Queue Update at ${queueEntry.shop.name}`,
                `Your queue entry #${queueEntry.orderOrQueueNumber} has been cancelled.`,
                {
                    type: 'queue_cancelled',
                    queueId: id,
                    shopId: queueEntry.shop._id.toString()
                }
            );

            // Also send socket notification
            io.to(queueEntry.userId.toString()).emit('queue:cancelled', {
                title: `Queue Update at ${queueEntry.shop.name}`,
                message: `Your queue entry #${queueEntry.orderOrQueueNumber} has been cancelled.`,
                data: {
                    type: 'queue_cancelled',
                    queueId: id,
                    shopId: queueEntry.shop._id.toString()
                }
            });
        }

        // Notify all users whose positions changed
        for (const entry of remainingQueue) {
            if (entry.userId && entry.orderOrQueueNumber !== entry._previousOrder) {
                await sendPushNotification(
                    entry.userId,
                    `Queue Update at ${queueEntry.shop.name}`,
                    `Your new position is #${entry.orderOrQueueNumber}`,
                    {
                        type: 'queue_position_change',
                        queueId: entry._id.toString(),
                        newPosition: entry.orderOrQueueNumber
                    }
                );
            }
        }

        await emitQueueUpdate(queueEntry.shop._id.toString());

        res.json({
            success: true,
            message: 'Queue entry cancelled successfully',
            data: queueEntry
        });
    } catch (err) {
        console.error('Error in removeFromQueue:', err);
        throw err;
    }
});


    // @desc    Update queue entry status (e.g., in-progress, completed)
    // @route   PUT /api/queue/:id/status
    // @access  Private (Barber, Owner, Admin)
const updateQueueStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, barberId } = req.body;

    if (!['in-progress', 'completed'].includes(status)) {
        throw new ApiError('Invalid status. Must be "in-progress" or "completed".', 400);
    }

    const queueEntry = await Queue.findById(id)
        .populate('shop', '_id name owner')
        .populate('userId', '_id name')
        .populate('barber', 'name')
        .populate('services._id', 'name price');

    if (!queueEntry) {
        throw new ApiError('Queue entry not found', 404);
    }

    // If marking as completed, require barberId
    if (status === 'completed') {
        if (!barberId) {
            throw new ApiError('Barber ID is required when completing service', 400);
        }

        const barber = await Barber.findById(barberId);
        if (!barber) {
            throw new ApiError('Barber not found', 404);
        }

        queueEntry.barber = barberId;
    }

    const oldStatus = queueEntry.status;
    queueEntry.status = status;

    if (status === 'completed' && oldStatus !== 'completed') {
        const servicesForHistory = queueEntry.services.map(service => ({
            service: service._id,
            quantity: 1,
            name: service.name,
            price: service.price
        }));

        const historyEntry = await History.create({
            user: queueEntry.userId ? queueEntry.userId._id : null,
            customerName: queueEntry.userId ? queueEntry.userId.name : queueEntry.customerName,
            barber: barberId,
            shop: queueEntry.shop._id,
            services: servicesForHistory,
            totalCost: queueEntry.totalCost,
            date: new Date(),
            uniqueCode: queueEntry.uniqueCode,
            orderOrQueueNumber: queueEntry.orderOrQueueNumber
        });

        // Update barber's stats
        await Barber.findByIdAndUpdate(barberId, { 
            $inc: { customersServed: 1 },
            $push: { history: historyEntry._id }
        });

        // Update user's history
        if (queueEntry.userId) {
            await User.findByIdAndUpdate(queueEntry.userId._id, {
                $push: { history: historyEntry._id }
            });

            // Send completion notification to user
            await sendPushNotification(
                queueEntry.userId._id,
                `Service Completed at ${queueEntry.shop.name}!`,
                `Your service with ${queueEntry.barber?.name || 'the barber'} is complete. Thank you!`,
                { 
                    type: 'service_completed',
                    queueId: id,
                    shopId: queueEntry.shop._id.toString()
                }
            );

            // Also send socket notification
            io.to(queueEntry.userId._id.toString()).emit('queue:service_completed', {
                title: `Service Completed at ${queueEntry.shop.name}!`,
                message: `Your service is complete. Thank you!`,
                data: {
                    type: 'service_completed',
                    queueId: id,
                    shopId: queueEntry.shop._id.toString()
                }
            });
        }

        // Update shop stats
        await Shop.findByIdAndUpdate(queueEntry.shop._id, {
            $inc: { 
                totalServicesCompleted: 1, 
                totalRevenue: queueEntry.totalCost 
            }
        });
    }

    await queueEntry.save();
    await emitQueueUpdate(queueEntry.shop._id.toString());
    
    res.json({ 
        success: true, 
        message: `Queue entry status updated to ${status}.`, 
        data: queueEntry 
    });
});


    // @desc    Update services for an existing queue entry
// @route   PATCH /api/queue/:id/services
// @access  Private (User or Guest via token or ID)
const updateQueueServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { services } = req.body; // Expecting [{ service: <id>, quantity: 1 }]

  if (!Array.isArray(services) || services.length === 0) {
    throw new ApiError('At least one service must be selected.', 400);
  }

  const queueEntry = await Queue.findById(id).populate('shop');
  if (!queueEntry || queueEntry.status !== 'pending') {
    throw new ApiError('Cannot modify queue entry.', 400);
  }

  const shop = queueEntry.shop;

  // Validate and build updated services array
  let totalCost = 0;
  const updatedServices = [];

  for (const reqService of services) {
    const match = shop.services.find(s => s._id.toString() === reqService.service);
    if (!match) throw new ApiError(`Service not found: ${reqService.service}`, 400);
    const quantity = Math.max(1, parseInt(reqService.quantity) || 1);

    for (let i = 0; i < quantity; i++) {
      updatedServices.push({ name: match.name, price: match.price });
    }
    totalCost += match.price * quantity;
  }

  queueEntry.services = updatedServices;
  queueEntry.totalCost = totalCost;
  await queueEntry.save();

  await emitQueueUpdate(shop._id.toString());

  res.json({ success: true, message: 'Queue entry updated', data: queueEntry });
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

    const nextEntry = await Queue.findOne({
        shop: currentEntry.shop,
        orderOrQueueNumber: { $gt: currentEntry.orderOrQueueNumber },
        status: { $in: ['pending', 'in-progress'] }
    }).sort({ orderOrQueueNumber: 1 });

    if (!nextEntry) {
        throw new ApiError('Cannot move down, already last in queue or no next person.', 400);
    }

    // Debug: Log current state
    console.log(`Moving entry ${currentEntry._id} from ${currentEntry.orderOrQueueNumber} to ${nextEntry.orderOrQueueNumber}`);
    console.log(`Next entry ${nextEntry._id} moving to ${currentEntry.orderOrQueueNumber}`);

    // Swap positions
    const currentOrder = currentEntry.orderOrQueueNumber;
    currentEntry.orderOrQueueNumber = nextEntry.orderOrQueueNumber;
    nextEntry.orderOrQueueNumber = currentOrder;

    await currentEntry.save();
    await nextEntry.save();

    // Prepare notification data
    const prepareNotification = async (entry, newPosition) => {
        if (!entry.userId) return null;
        
        const shop = await Shop.findById(entry.shop);
        return {
            title: `Queue Update at ${shop?.name || 'the shop'}`,
            message: `Your position changed to #${newPosition}`,
            data: {
                type: 'queue_position_change',
                queueId: entry._id.toString(),
                shopId: entry.shop.toString(),
                newPosition,
                uniqueCode: entry.uniqueCode
            }
        };
    };

    // Handle current user (moved down)
    if (currentEntry.userId) {
        const notification = await prepareNotification(currentEntry, currentEntry.orderOrQueueNumber);
        
        console.log(`Emitting to user ${currentEntry.userId} in room?`, 
            io.sockets.adapter.rooms.has(currentEntry.userId.toString()));
        
        // Send both push and socket notification
        await sendPushNotification(
            currentEntry.userId, 
            notification.title, 
            notification.message, 
            notification.data
        );
        
        io.to(currentEntry.userId.toString()).emit('queue:position_changed', notification);
    }

    // Handle next user (moved up)
    if (nextEntry.userId) {
        const notification = await prepareNotification(nextEntry, nextEntry.orderOrQueueNumber);
        
        await sendPushNotification(
            nextEntry.userId, 
            notification.title, 
            notification.message, 
            notification.data
        );
        
        io.to(nextEntry.userId.toString()).emit('queue:position_changed', notification);
    }

    // Update all clients viewing this shop's queue
    await emitQueueUpdate(currentEntry.shop);

    res.json({ 
        success: true,
        message: `Queue positions updated successfully.`,
        data: {
            movedDown: currentEntry,
            movedUp: nextEntry
        }
    });
});



    return {
        addToQueue,
        addWalkInToQueue,
        removeFromQueue,
        updateQueueStatus,
        updateQueueServices,
        getShopQueue,
        getBarberQueue,
         movePersonDownInQueue,
    };
};