// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const User = require('../models/User');
const Owner = require('../models/Owner');
const Barber = require('../models/Barber');
const Admin = require('../models/Admin');
const Shop = require('../models/Shop'); // Import Shop model
require('dotenv').config();

const protect = (roles = []) => asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError('Not authorized, no token', 401);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user; // Generic variable to hold the authenticated entity
        // Try to find the user based on roles or all types
        if (roles.includes('user') || roles.length === 0) {
            user = await User.findById(decoded.id).select('-pass');
            if (user) {
                req.user = user;
                req.userType = 'User';
            }
        }
        if (!user && (roles.includes('owner') || roles.length === 0)) {
            user = await Owner.findById(decoded.id).select('-pass');
            if (user) {
                req.user = user;
                req.userType = 'Owner';
            }
        }
        if (!user && (roles.includes('barber') || roles.length === 0)) {
            user = await Barber.findById(decoded.id).select('-pass');
            if (user) {
                req.user = user;
                req.userType = 'Barber';
            }
        }
        if (!user && (roles.includes('admin') || roles.length === 0)) {
            user = await Admin.findById(decoded.id).select('-pass');
            if (user) {
                req.user = user;
                req.userType = 'Admin';
            }
        }

        if (!req.user) {
            throw new ApiError('Not authorized, user/entity not found', 401);
        }

        // Check if the user's type matches the required roles
        if (roles.length > 0 && !roles.includes(req.userType.toLowerCase())) {
            throw new ApiError(`Not authorized as ${req.userType} for this route. Required roles: ${roles.join(', ')}`, 403);
        }

        next();
    } catch (error) {
        console.error(error);
        throw new ApiError('Not authorized, token failed', 401);
    }
});

// Specific role authorization middleware (optional, can be combined with protect)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userType.toLowerCase())) {
            return next(new ApiError(`User role ${req.userType} is not authorized to access this route`, 403));
        }
        next();
    };
};

// @desc    Middleware to check and update User subscription status
const checkUserSubscription = asyncHandler(async (req, res, next) => {
    // This middleware should run AFTER `protect(['user'])`
    if (!req.user || req.userType !== 'User') {
        // This case should ideally be caught by 'protect' middleware
        return next(new ApiError('User not authenticated or not a User type.', 401));
    }

    const user = req.user;
    const now = new Date();
    let statusUpdated = false;

    if (user.subscription.status === 'trial' && user.subscription.trialEndDate && user.subscription.trialEndDate < now) {
        user.subscription.status = 'expired';
        user.subscription.trialEndDate = undefined; // Clear trial end date once expired
        statusUpdated = true;
    } else if (user.subscription.status === 'active' && user.subscription.lastPlanInfo && user.subscription.lastPlanInfo.endDate && user.subscription.lastPlanInfo.endDate < now) {
        user.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await user.save();
        console.log(`User ${user._id} subscription status updated to 'expired'`);
    }

    // You can also throw an error here if an expired subscription should block the request
    // if (user.subscription.status === 'expired') {
    //     return next(new ApiError('Your subscription has expired. Please renew to continue.', 402)); // 402 Payment Required
    // }

    next();
});

// @desc    Middleware to check and update Shop subscription status
const checkShopSubscription = asyncHandler(async (req, res, next) => {
    // This middleware should run AFTER `protect(['owner'])` for owner-specific routes
    // Or, for shop-specific routes, you might fetch the shop first.
    // For simplicity, we'll assume the shopId is available in req.params or req.body,
    // or if the user is an owner, we check their shops.

    let shop;
    if (req.params.shopId) {
        shop = await Shop.findById(req.params.shopId);
    } else if (req.body.shopId) {
        shop = await Shop.findById(req.body.shopId);
    } else if (req.userType === 'Owner' && req.user.shops && req.user.shops.length > 0) {
        // If an owner, we might check their first shop or require a shopId in body/params
        // For routes where an owner manages a *specific* shop, shopId in params/body is better.
        // For now, let's assume shopId is passed. If not, this needs more specific logic based on route.
        // If the owner has multiple shops, you'd need to determine which one is being managed.
        // For simplicity, we'll assume shopId is provided in the request for shop-specific actions.
        return next(); // If no shopId easily identifiable, skip this check here.
    }


    if (!shop) {
        // If shop cannot be determined or found, proceed.
        // The controller responsible for handling the shop should throw 404.
        return next();
    }

    const now = new Date();
    let statusUpdated = false;

    if (shop.subscription.status === 'trial' && shop.subscription.trialEndDate && shop.subscription.trialEndDate < now) {
        shop.subscription.status = 'expired';
        shop.subscription.trialEndDate = undefined; // Clear trial end date
        statusUpdated = true;
    } else if (shop.subscription.status === 'active' && shop.subscription.lastPlanInfo && shop.subscription.lastPlanInfo.endDate && shop.subscription.lastPlanInfo.endDate < now) {
        shop.subscription.status = 'expired';
        statusUpdated = true;
    }

    if (statusUpdated) {
        await shop.save();
        console.log(`Shop ${shop._id} subscription status updated to 'expired'`);
    }

    // Similar to users, you can choose to block requests immediately if expired
    // if (shop.subscription.status === 'expired') {
    //     return next(new ApiError('Shop subscription has expired. Features disabled.', 402));
    // }

    next();
});


module.exports = { protect, authorize, checkUserSubscription, checkShopSubscription };
