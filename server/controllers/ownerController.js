// controllers/ownerController.js
const Owner = require('../models/Owner');
const Shop = require('../models/Shop'); // Will need this for getOwnerShops
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Register a new owner
// @route   POST /api/owners/register
// @access  Public
exports.registerOwner = asyncHandler(async (req, res) => {
    const { name, phone, pass } = req.body;

    const ownerExists = await Owner.findOne({ phone });

    if (ownerExists) {
        throw new ApiError('Owner already exists with this phone number', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const owner = await Owner.create({
        name,
        phone,
        pass: hashedPassword,
    });

    if (owner) {
        res.status(201).json({
            success: true,
            message: 'Owner registered successfully',
            data: {
                _id: owner._id,
                name: owner.name,
                phone: owner.phone,
                token: generateToken(owner._id),
            },
        });
    } else {
        throw new ApiError('Invalid owner data', 400);
    }
});

// @desc    Authenticate owner & get token
// @route   POST /api/owners/login
// @access  Public
exports.loginOwner = asyncHandler(async (req, res) => {
    const { phone, pass } = req.body;

    const owner = await Owner.findOne({ phone });

    if (owner && (await bcrypt.compare(pass, owner.pass))) {
        res.json({
            success: true,
            message: 'Owner logged in successfully',
            data: {
                _id: owner._id,
                name: owner.name,
                phone: owner.phone,
                token: generateToken(owner._id),
            },
        });
    } else {
        throw new ApiError('Invalid phone or password', 401);
    }
});

// @desc    Get owner profile
// @route   GET /api/owners/profile
// @access  Private (Owner)
exports.getOwnerProfile = asyncHandler(async (req, res) => {
    // req.user is populated by the protect middleware
    const owner = await Owner.findById(req.user._id).select('-pass'); // Exclude password

    if (owner) {
        res.json({
            success: true,
            data: owner,
        });
    } else {
        throw new ApiError('Owner not found', 404);
    }
});

// @desc    Update owner profile
// @route   PUT /api/owners/profile
// @access  Private (Owner)
exports.updateOwnerProfile = asyncHandler(async (req, res) => {
    const owner = await Owner.findById(req.user._id);

    if (owner) {
        owner.name = req.body.name || owner.name;
        owner.phone = req.body.phone || owner.phone;
        // Optionally update password if provided
        if (req.body.pass) {
            const salt = await bcrypt.genSalt(10);
            owner.pass = await bcrypt.hash(req.body.pass, salt);
        }
        if (req.body.expopushtoken) {
            owner.expopushtoken = req.body.expopushtoken;
        }

        const updatedOwner = await owner.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                _id: updatedOwner._id,
                name: updatedOwner.name,
                phone: updatedOwner.phone,
                // Do not send token again unless new login is required
            },
        });
    } else {
        throw new ApiError('Owner not found', 404);
    }
});

// @desc    Get all shops owned by the logged-in owner
// @route   GET /api/owners/me/shops
// @access  Private (Owner)
exports.getOwnerShops = asyncHandler(async (req, res) => {
    // req.user contains the owner's data from the protect middleware
    const shops = await Shop.find({ owner: req.user._id })
                             .populate('services.service', 'name') // Populate service details
                             .populate('barbers', 'name phone'); // Populate barber details

    res.json({
        success: true,
        data: shops,
    });
});
