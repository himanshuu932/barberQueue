// controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const { asyncHandler, ApiError } = require('../utils/errorHandler');

// @desc    Create a new subscription plan (Admin only)
// @route   POST /api/subscriptions
// @access  Private (Admin)
exports.createSubscriptionPlan = asyncHandler(async (req, res) => {
    try{
    console.log("hio");
    const { name, price, duration, features } = req.body;
     console.log(req.body);
    const subscriptionExists = await Subscription.findOne({ name });
    if (subscriptionExists) {
        throw new ApiError('Subscription plan with this name already exists', 400);
    }

    const subscriptionPlan = await Subscription.create({
        name,
        price,
        duration,
        features,
    });

    res.status(201).json({
        success: true,
        message: 'Subscription plan created successfully',
        data: subscriptionPlan,
    });
}
catch(err)
{
    console.log(err);
}
});

// @desc    Get all available subscription plans
// @route   GET /api/subscriptions
// @access  Public
exports.getAllSubscriptionPlans = asyncHandler(async (req, res) => {
    const subscriptionPlans = await Subscription.find({ isActive: true });
    res.json({
        success: true,
        data: subscriptionPlans,
    });
});


exports.getSubscriptionPlanById = asyncHandler(async (req, res) => {
    const subscriptionPlan = await Subscription.findById(req.params.id);
    if (!subscriptionPlan) {
        throw new ApiError('Subscription plan not found', 404);
    }
    res.json({
        success: true,
        data: subscriptionPlan,
    });
});

// @desc    Update a subscription plan (Admin only)
// @route   PUT /api/subscriptions/:id
// @access  Private (Admin)
exports.updateSubscriptionPlan = asyncHandler(async (req, res) => {
    const { name, price, duration, features, isActive } = req.body;

    const subscriptionPlan = await Subscription.findById(req.params.id);

    if (!subscriptionPlan) {
        throw new ApiError('Subscription plan not found', 404);
    }

    if (name && name !== subscriptionPlan.name) {
        const existing = await Subscription.findOne({ name });
        if (existing) {
            throw new ApiError('Another plan with this name already exists', 400);
        }
    }

    subscriptionPlan.name = name || subscriptionPlan.name;
    subscriptionPlan.price = price !== undefined ? price : subscriptionPlan.price;
    subscriptionPlan.duration = duration || subscriptionPlan.duration;
    subscriptionPlan.features = features || subscriptionPlan.features;
    subscriptionPlan.isActive = isActive !== undefined ? isActive : subscriptionPlan.isActive;

    const updatedPlan = await subscriptionPlan.save();

    res.json({
        success: true,
        message: 'Subscription plan updated successfully',
        data: updatedPlan,
    });
});

// @desc    Delete a subscription plan (Admin only)
// @route   DELETE /api/subscriptions/:id
// @access  Private (Admin)
exports.deleteSubscriptionPlan = asyncHandler(async (req, res) => {
    const subscriptionPlan = await Subscription.findById(req.params.id);

    if (!subscriptionPlan) {
        throw new ApiError('Subscription plan not found', 404);
    }

    // Consider logic to prevent deletion if shops/users are currently subscribed to this plan.
    // For simplicity, we'll allow deletion for now.

    await subscriptionPlan.deleteOne();

    res.json({
        success: true,
        message: 'Subscription plan deleted successfully',
    });
});
