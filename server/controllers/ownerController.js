// controllers/ownerController.js
const Owner = require('../models/Owner');
const Shop = require('../models/Shop');
const History = require('../models/History'); // Import the History model
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const {generateOTP, storeOTP, verifyOTP} = require('../utils/otpStore');
const mailjet = require('node-mailjet').apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);
// @desc    Register a new owner
// @route   POST /api/owners/register
// @access  Public
exports.registerOwner = asyncHandler(async (req, res) => {
    const { name, email, phone, pass } = req.body;

    const ownerExists = await Owner.findOne({ email });

    if (ownerExists) {
        throw new ApiError('Owner already exists with this email ', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const owner = await Owner.create({
        name,
        email,
        phone,
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
    const { email, pass } = req.body;
    console.log('Login attempt with email:', email);
    const owner = await Owner.findOne({ email });
      if( !owner) {
       throw new ApiError('No Such User', 401);
        }
    
           if( !(await bcrypt.compare(pass, owner.pass))) {
            throw new ApiError('Wrong Password', 401);
        }

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
    const shops = await Shop.find({ owner: req.user._id }).populate('barbers');

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

exports.initiatePasswordChange = asyncHandler(async (req, res) => {
    try {
        // Get user from database
        const user = await Owner.findById(req.user._id);
        if (!user) {
            console.error('[Password Change] ERROR: User not found for ID:', req.user._id);
            throw new ApiError('User not found', 404);
        }
        // Generate and store OTP
        const otp = generateOTP();
        storeOTP(user.email, otp);
        // Prepare email data
        const emailData = {
            From: {
                Email: process.env.EMAIL_FROM,
                Name: process.env.AppNameForEmail,
            },
            To: [{
                Email: user.email
            }],
            Subject: 'Password Change Verification',
            TextPart: `Your OTP is: ${otp}`,
            HTMLPart: `<h3>Your OTP is: <strong>${otp}</strong></h3><p>This OTP will expire in 10 minutes and is required to change your password.</p>`
        };
        // Send OTP via Mailjet
        try {
          
            const startTime = Date.now();
            
            const mailjetResponse = await mailjet
                .post('send', { version: 'v3.1' })
                .request({ Messages: [emailData] });
                
            const responseTime = Date.now() - startTime;
            res.json({
                success: true,
                message: 'OTP sent successfully to your registered email'
            });
            
        } catch (mailjetError) {
            console.error('[Password Change] ERROR: Mailjet failed:', {
                error: mailjetError.message,
                statusCode: mailjetError.statusCode,
                stack: mailjetError.stack
            });
            
            if (mailjetError.statusCode) {
                console.error('[Password Change] Mailjet error details:', {
                    statusCode: mailjetError.statusCode,
                    errorInfo: mailjetError.errorInfo
                });
            }
            
            throw new ApiError('Failed to send OTP', 500);
        }
    } catch (error) {
        console.error('[Password Change] FINAL ERROR:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        // Re-throw the error to be handled by asyncHandler
        throw error;
    }
});
// @desc    Verify OTP and change password
// @route   POST /api/users/change-password/confirm
// @access  Private (User)
exports.confirmPasswordChange = asyncHandler(async (req, res) => {
    const { otp, newPassword } = req.body;
    
    if (!otp || !newPassword) {
        throw new ApiError('OTP and new password are required', 400);
    }

    const user = await Owner.findById(req.user._id);
    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // Verify OTP
    const isValid = verifyOTP(user.email, otp);
    if (!isValid) {
        throw new ApiError('Invalid OTP or OTP expired', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.pass = hashedPassword;
    await user.save();

    res.json({
        success: true,
        message: 'Password changed successfully'
    });
});

exports.initiatePasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError('Email is required', 400);
    }

    const user = await Owner.findOne({ email });
    if (!user) {
        // For security, don't reveal if user exists or not
        return res.json({
            success: true,
            message: 'If an account with this email exists, a reset OTP has been sent'
        });
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Prepare email data
    const emailData = {
        From: {
            Email: process.env.EMAIL_FROM,
            Name: process.env.AppNameForEmail,
        },
        To: [{
            Email: user.email
        }],
        Subject: 'Password Reset Request',
        TextPart: `Your password reset OTP is: ${otp}`,
        HTMLPart: `
            <h3>Password Reset Request</h3>
            <p>Your OTP is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };

    // Send OTP via Mailjet
    try {
        await mailjet
            .post('send', { version: 'v3.1' })
            .request({ Messages: [emailData] });

        res.json({
            success: true,
            message: 'If an account with this email exists, a reset OTP has been sent'
        });
    } catch (mailjetError) {
        console.error('[Password Reset] Mailjet error:', mailjetError);
        throw new ApiError('Failed to send OTP', 500);
    }
});

// @desc    Verify OTP and reset password (forgot password flow)
// @route   POST /api/users/reset-password
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
        throw new ApiError('Email, OTP and new password are required', 400);
    }

    const user = await Owner.findOne({ email });
    if (!user) {
        throw new ApiError('Invalid request', 400);
    }

    // Verify OTP
    const isValid = verifyOTP(email, otp);
    if (!isValid) {
        throw new ApiError('Invalid OTP or OTP expired', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.pass = hashedPassword;
    await user.save();

    res.json({
        success: true,
        message: 'Password reset successfully'
    });
});