// controllers/historyController.js
const History = require('../models/History');
const User = require('../models/User');
const Barber = require('../models/Barber');
const Shop = require('../models/Shop');
const { asyncHandler, ApiError } = require('../utils/errorHandler');

// Note: createHistoryRecord is typically called internally by queueController.updateQueueStatus
// It's exposed here for completeness or direct administrative history logging.

// @desc    Create a new history record
// @route   POST /api/history (mostly internal use, or for specific administrative logging)
// @access  Private (Admin, or internal system process)
exports.createHistoryRecord = asyncHandler(async (req, res) => {
    const { userId, barberId, shopId, services, totalCost, rating } = req.body;

    // Basic validation
    if (!userId || !barberId || !shopId || !services || services.length === 0 || totalCost === undefined) {
        throw new ApiError('Missing required history fields', 400);
    }

    // Verify references exist (optional, but good practice)
    const user = await User.findById(userId);
    const barber = await Barber.findById(barberId);
    const shop = await Shop.findById(shopId);

    if (!user || !barber || !shop) {
        throw new ApiError('Invalid User, Barber, or Shop reference.', 400);
    }

    const history = await History.create({
        user: userId,
        barber: barberId,
        shop: shopId,
        services,
        totalCost,
        rating,
        date: new Date() // Record current timestamp
    });

    res.status(201).json({
        success: true,
        message: 'History record created',
        data: history,
    });
});


// @desc    Get user's service history
// @route   GET /api/history/user/:userId (or /api/me/history)
// @access  Private (User - own history, Admin)
exports.getUserHistory = asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId || req.user._id; // Allow fetching own history if no param

    // Authorization: A user can only fetch their own history unless they are an Admin
    if (req.userType === 'User' && targetUserId.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view other user\'s history', 403);
    }
    // Admin user has implicit access from authMiddleware role check

    const history = await History.find({ user: targetUserId })
                                 .populate('barber', 'name')
                                 .populate('shop', 'name')
                                 .populate('services.service', 'name')
                                 .sort({ date: -1 });

    res.json({
        success: true,
        data: history,
    });
});

// @desc    Get barber's service history
// @route   GET /api/history/barber/:barberId (or /api/me/history if barber)
// @access  Private (Barber - own history, Owner of shop, Admin)
exports.getBarberHistory = asyncHandler(async (req, res) => {
    const targetBarberId = req.params.barberId || req.user._id; // Allow fetching own history if no param

    const barber = await Barber.findById(targetBarberId);
    if (!barber) {
        throw new ApiError('Barber not found', 404);
    }

    // Authorization:
    // A barber can only fetch their own history.
    // An owner can fetch history for barbers in their shops.
    // An admin can fetch any barber's history.
    if (req.userType === 'Barber' && targetBarberId.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view other barber\'s history', 403);
    }
    if (req.userType === 'Owner') {
        const shop = await Shop.findById(barber.shopId);
        if (!shop || shop.owner.toString() !== req.user._id.toString()) {
            throw new ApiError('Not authorized to view this barber\'s history (not from your shop)', 403);
        }
    }
    // Admin user has implicit access from authMiddleware role check

    const history = await History.find({ barber: targetBarberId })
                                 .populate('user', 'name')
                                 .populate('shop', 'name')
                                 .populate('services.service', 'name')
                                 .sort({ date: -1 });

    res.json({
        success: true,
        data: history,
    });
});

// @desc    Get shop's overall service history
// @route   GET /api/history/shop/:shopId
// @access  Private (Owner of shop, Admin)
exports.getShopHistory = asyncHandler(async (req, res) => {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }

    // Authorization: Only owner of the shop or Admin can view
    if (req.userType === 'Owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to view this shop\'s history', 403);
    }
    // Admin user has implicit access

    const history = await History.find({ shop: shopId })
                                 .populate('user', 'name')
                                 .populate('barber', 'name')
                                 .populate('services.service', 'name')
                                 .sort({ date: -1 });

    res.json({
        success: true,
        data: history,
    });
});
