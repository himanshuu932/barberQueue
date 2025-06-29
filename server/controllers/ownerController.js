// controllers/ownerController.js
const Owner = require('../models/Owner');
const Shop = require('../models/Shop');
const History = require('../models/History'); // Import the History model
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Register a new owner
// @route   POST /api/owners/register
// @access  Public
exports.registerOwner = asyncHandler(async (req, res) => {
    const { name, email, pass } = req.body;

    const ownerExists = await Owner.findOne({ email });

    if (ownerExists) {
        throw new ApiError('Owner already exists with this email ', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const owner = await Owner.create({
        name,
        email,
         emailVerified: true,
        pass: hashedPassword,
    });

    if (owner) {
        res.status(201).json({
            success: true,
            message: 'Owner registered successfully',
            data: {
                _id: owner._id,
                name: owner.name,
                email: owner.email,
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
    const { email, pass } = req.body;
    console.log('Login attempt with email:', email);
    const owner = await Owner.findOne({ email });

    if (owner && (await bcrypt.compare(pass, owner.pass))) {
        res.json({
            success: true,
            message: 'Owner logged in successfully',
            data: {
                _id: owner._id,
                name: owner.name,
                email: owner.email,
                token: generateToken(owner._id),
            },
        });
    } else {
        throw new ApiError('Invalid email or password', 401);
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
        owner.email = req.body.email || owner.email;
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
                email: updatedOwner.email,
                // Do not send token again unless new login is required
            },
        });
    } else {
        throw new ApiError('Owner not found', 404);
    }
});

exports.getOwnerShops = asyncHandler(async (req, res) => {
    // req.user contains the owner's data from the protect middleware
    const shops = await Shop.find({ owner: req.user._id });

    const shopsWithHistory = await Promise.all(shops.map(async (shop) => {
        const history = await History.find({ shop: shop._id })
            .populate('user', 'name') // Populate user name
            .populate('barber', 'name') // Populate barber name
            .populate('services.service', 'name'); // Populate service name

        return {
            ...shop.toObject(), // Convert Mongoose document to a plain JavaScript object
            history: history,
        };
    }));

    res.json({
        success: true,
        data: shopsWithHistory,
    });
});