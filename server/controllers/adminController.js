// controllers/adminController.js
const Admin = require('../models/Admin');
const User = require('../models/User');
const Owner = require('../models/Owner');
const Shop = require('../models/Shop');
const Barber = require('../models/Barber');
const Service = require('../models/Service');
const Subscription = require('../models/Subscription');
const History = require('../models/History');
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// Define functions internally
const registerAdmin = asyncHandler(async (req, res) => {
    console.log("this is from admin register request: "+req.body.pass);
    const { name, email, pass, role } = req.body;

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
        throw new ApiError('Admin with this email already exists', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const admin = await Admin.create({
        name,
        email,
        pass: hashedPassword,
        role: role || 'moderator',
    });

    if (admin) {
        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            data: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                token: generateToken(admin._id, admin.role),
            },
        });
    } else {
        throw new ApiError('Invalid admin data', 400);
    }
});

const adminLogin = asyncHandler(async (req, res) => {
    const { email, pass } = req.body;

    const admin = await Admin.findOne({ email });

    if (admin && (await bcrypt.compare(pass, admin.pass))) {
        admin.lastLogin = new Date();
        await admin.save();

        res.json({
            success: true,
            message: 'Admin logged in successfully',
            data: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                token: generateToken(admin._id, admin.role),
            },
        });
    } else {
        throw new ApiError('Invalid email or password', 401);
    }
});

const getAdminProfile = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user._id).select('-pass');
    if (!admin) {
        throw new ApiError('Admin not found', 404);
    }
    res.json({ success: true, data: admin });
});

const updateAdminProfile = asyncHandler(async (req, res) => {
    const { name, email, pass } = req.body;
    const admin = await Admin.findById(req.user._id);

    if (!admin) {
        throw new ApiError('Admin not found', 404);
    }

    admin.name = name || admin.name;
    admin.email = email || admin.email;
    if (pass) {
        const salt = await bcrypt.genSalt(10);
        admin.pass = await bcrypt.hash(pass, salt);
    }

    const updatedAdmin = await admin.save();
    res.json({
        success: true,
        message: 'Admin profile updated',
        data: {
            _id: updatedAdmin._id,
            name: updatedAdmin.name,
            email: updatedAdmin.email,
            role: updatedAdmin.role
        }
    });
});

const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-pass');
    res.json({ success: true, data: users });
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        throw new ApiError('User not found', 404);
    }
    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
});

const getShops = asyncHandler(async (req, res) => {
    try{
    console.log("here");
    const shops = await Shop.find({}).populate('owner', 'name email').populate('barbers', 'name');
  
    res.json({ success: true, data: shops });}
    catch(err)
    {
        console.log(err);
    }
});

const deleteShop = asyncHandler(async (req, res) => {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
        throw new ApiError('Shop not found', 404);
    }
    await shop.deleteOne();
    res.json({ success: true, message: 'Shop deleted successfully' });
});

// Added these missing functions for completeness as they were in the routes
const getOwners = asyncHandler(async (req, res) => {
    const owners = await Owner.find({})
        .select('-pass') // Exclude the 'pass' field from the Owner document
        .populate({
            path: 'shops', // Populate the 'shops' field in the Owner document
            model: 'Shop', // Specify the model to use for population (optional if ref is defined in schema)
            populate: {
                path: 'barbers', // For each populated shop, populate the 'barbers' field
                model: 'Barber' // Specify the model for barbers
            }
        });
    res.json({ success: true, data: owners });
});

const getBarbers = asyncHandler(async (req, res) => {
    const barbers = await Barber.find({}).select('-pass');
    res.json({ success: true, data: barbers });
});


const getSystemAnalytics = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalOwners = await Owner.countDocuments();
    const totalShops = await Shop.countDocuments();
    const totalBarbers = await Barber.countDocuments();
    const totalServicesRendered = await History.aggregate([
        { $unwind: "$services" },
        { $group: { _id: null, count: { $sum: "$services.quantity" } } }
    ]);
    const activeSubscriptions = await Shop.countDocuments({ "subscription.status": "active" });

    res.json({
        success: true,
        data: {
            totalUsers,
            totalOwners,
            totalShops,
            totalBarbers,
            totalServicesRendered: totalServicesRendered[0] ? totalServicesRendered[0].count : 0,
            activeSubscriptions,
        },
    });
});

// Explicitly export all functions as an object
module.exports = {
    registerAdmin,
    adminLogin,
    getAdminProfile,
    updateAdminProfile,
    getUsers,
    deleteUser,
    getShops,
    deleteShop,
    getOwners, // Exported now
    getBarbers, // Exported now
    getSystemAnalytics
};
