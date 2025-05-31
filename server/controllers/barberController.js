// controllers/barberController.js
const Barber = require('../models/Barber');
const Shop = require('../models/Shop'); // Needed to verify shop exists
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Create a new barber (by Owner)
// @route   POST /api/barbers
// @access  Private (Owner)
exports.createBarber = asyncHandler(async (req, res) => {
    const { shopId, name, phone, pass } = req.body;

    // Verify the shop exists and belongs to the owner
    const shop = await Shop.findOne({ _id: shopId, owner: req.user._id });
    if (!shop) {
        throw new ApiError('Shop not found or you are not the owner of this shop', 404);
    }

    const barberExists = await Barber.findOne({ phone });
    if (barberExists) {
        throw new ApiError('Barber already exists with this phone number', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const barber = await Barber.create({
        shopId,
        name,
        phone,
        pass: hashedPassword,
    });

    // Add barber to the shop's barbers array
    shop.barbers.push(barber._id);
    await shop.save();

    res.status(201).json({
        success: true,
        message: 'Barber created successfully',
        data: {
            _id: barber._id,
            name: barber.name,
            phone: barber.phone,
            shop: shop.name,
        },
    });
});

// @desc    Get barber by ID
// @route   GET /api/barbers/:id
// @access  Public
exports.getBarberById = asyncHandler(async (req, res) => {
    const barber = await Barber.findById(req.params.id).select('-pass').populate('shopId', 'name address'); // Exclude password and populate shop details

    if (barber) {
        res.json({
            success: true,
            data: barber,
        });
    } else {
        throw new ApiError('Barber not found', 404);
    }
});

// @desc    Get all barbers for a specific shop
// @route   GET /api/shops/:shopId/barbers
// @access  Public
exports.getBarbersByShop = asyncHandler(async (req, res) => {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }

    const barbers = await Barber.find({ shopId: shopId }).select('-pass'); // Get barbers for that shop

    res.json({
        success: true,
        data: barbers,
    });
});

// @desc    Update barber details (by Owner or Barber themselves)
// @route   PUT /api/barbers/:id
// @access  Private (Owner or Barber)
exports.updateBarberDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, phone, pass } = req.body; // Pass can also be updated

    let barber = await Barber.findById(id);

    if (!barber) {
        throw new ApiError('Barber not found', 404);
    }

    // Authorization check: Only owner of the shop or the barber themselves can update
    const shop = await Shop.findById(barber.shopId);
    if (!shop) {
        throw new ApiError('Associated shop not found', 404);
    }

    // Check if the current user is the owner of the shop OR the barber themselves
    if (req.userType === 'Owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to update this barber: You are not the owner of this barber\'s shop', 403);
    }
    if (req.userType === 'Barber' && barber._id.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized to update this barber: You are not this barber', 403);
    }

    barber.name = name || barber.name;
    barber.phone = phone || barber.phone;

    if (pass) {
        const salt = await bcrypt.genSalt(10);
        barber.pass = await bcrypt.hash(pass, salt);
    }
    if (req.body.expopushtoken) {
        barber.expopushtoken = req.body.expopushtoken;
    }

    const updatedBarber = await barber.save();

    res.json({
        success: true,
        message: 'Barber updated successfully',
        data: {
            _id: updatedBarber._id,
            name: updatedBarber.name,
            phone: updatedBarber.phone,
        },
    });
});

// @desc    Delete a barber (by Owner)
// @route   DELETE /api/barbers/:id
// @access  Private (Owner)
exports.deleteBarber = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const barber = await Barber.findById(id);

    if (!barber) {
        throw new ApiError('Barber not found', 404);
    }

    // Verify the shop exists and belongs to the owner before deleting
    const shop = await Shop.findOne({ _id: barber.shopId, owner: req.user._id });
    if (!shop) {
        throw new ApiError('Not authorized: Barber\'s shop not found or you are not the owner', 403);
    }

    // Remove barber from the shop's barbers array
    shop.barbers = shop.barbers.filter(bId => bId.toString() !== barber._id.toString());
    await shop.save();

    await barber.deleteOne(); // Use deleteOne() for Mongoose 6+

    res.json({
        success: true,
        message: 'Barber removed successfully',
    });
});

// @desc    Toggle barber's activeTaking status (by Barber or Owner)
// @route   PUT /api/barbers/:id/toggle-active
// @access  Private (Owner, Barber)
exports.updateBarberActiveStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { activeTaking } = req.body; // Can be true or false

    const barber = await Barber.findById(id);

    if (!barber) {
        throw new ApiError('Barber not found', 404);
    }

    // Authorization check: Only owner of the shop or the barber themselves can update
    const shop = await Shop.findById(barber.shopId);
    if (!shop) {
        throw new ApiError('Associated shop not found', 404);
    }

    if (req.userType === 'Owner' && shop.owner.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized: You are not the owner of this barber\'s shop', 403);
    }
    if (req.userType === 'Barber' && barber._id.toString() !== req.user._id.toString()) {
        throw new ApiError('Not authorized: You are not this barber', 403);
    }

    barber.activeTaking = activeTaking !== undefined ? activeTaking : !barber.activeTaking; // Toggle if not provided
    await barber.save();

    res.json({
        success: true,
        message: 'Barber active status updated',
        data: {
            _id: barber._id,
            name: barber.name,
            activeTaking: barber.activeTaking,
        },
    });
});

// @desc    Get barber's customers served count
// @route   GET /api/barbers/:id/customers-served
// @access  Public (or Private for Barber/Owner if detailed analytics)
exports.getBarberCustomersServed = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const barber = await Barber.findById(id).select('name customersServed');

    if (!barber) {
        throw new ApiError('Barber not found', 404);
    }

    res.json({
        success: true,
        data: {
            _id: barber._id,
            name: barber.name,
            customersServed: barber.customersServed,
        },
    });
});
