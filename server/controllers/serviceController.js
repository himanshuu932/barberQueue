// controllers/serviceController.js
const Service = require('../models/Service');
const { asyncHandler, ApiError } = require('../utils/errorHandler');

// @desc    Create a new generic service (Admin only)
// @route   POST /api/services
// @access  Private (Admin)
exports.createService = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const serviceExists = await Service.findOne({ name });
    if (serviceExists) {
        throw new ApiError('Service with this name already exists', 400);
    }

    const service = await Service.create({ name });

    res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: service,
    });
});

// @desc    Get all generic services
// @route   GET /api/services
// @access  Public
exports.getAllServices = asyncHandler(async (req, res) => {
    const services = await Service.find({});
    res.json({
        success: true,
        data: services,
    });
});

// @desc    Get generic service by ID
// @route   GET /api/services/:id
// @access  Public
exports.getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id);
    if (!service) {
        throw new ApiError('Service not found', 404);
    }
    res.json({
        success: true,
        data: service,
    });
});

// @desc    Update a generic service (Admin only)
// @route   PUT /api/services/:id
// @access  Private (Admin)
exports.updateService = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError('Service not found', 404);
    }

    // Check if new name already exists for another service
    if (name && name !== service.name) {
        const existingService = await Service.findOne({ name });
        if (existingService) {
            throw new ApiError('Another service with this name already exists', 400);
        }
    }

    service.name = name || service.name;

    const updatedService = await service.save();

    res.json({
        success: true,
        message: 'Service updated successfully',
        data: updatedService,
    });
});

// @desc    Delete a generic service (Admin only)
// @route   DELETE /api/services/:id
// @access  Private (Admin)
exports.deleteService = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError('Service not found', 404);
    }

    // Consider adding a check to prevent deletion if the service is currently used by shops/queues/history.
    // For simplicity, we'll allow deletion for now.

    await service.deleteOne();

    res.json({
        success: true,
        message: 'Service deleted successfully',
    });
});
