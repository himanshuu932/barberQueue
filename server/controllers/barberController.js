// controllers/barberController.js
const Barber = require('../models/Barber');
const Shop = require('../models/Shop'); // Needed to verify shop exists
const History=require('../models/History');
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Create a new barber (by Owner)
// @route   POST /api/barbers
// @access  Private (Owner)
exports.authBarber = asyncHandler(async (req, res) => {
    const { email, pass } = req.body;

    const barber = await Barber.findOne({ email });

    if (barber && (await bcrypt.compare(pass, barber.pass))) {
        res.json({
            success: true,
            message: 'Barber logged in successfully',
            token: generateToken(barber._id), // Generate token for the barber
            barber: {
                _id: barber._id,
                name: barber.name,
                email: barber.email,
                shopId: barber.shopId, // Include shopId
            },
        });
    } else {
        throw new ApiError('Invalid credentials', 401);
    }
});

exports.createBarber = asyncHandler(async (req, res) => {
    const { shopId, name, email, pass } = req.body;
console.log('Creating barber with data:', { shopId, name, email, pass });
    // Verify the shop exists and belongs to the owner
    const shop = await Shop.findOne({ _id: shopId, owner: req.user._id });
    if (!shop) {
        throw new ApiError('Shop not found or you are not the owner of this shop', 404);
    }

    const barberExists = await Barber.findOne({ email });
    if (barberExists) {
        throw new ApiError('Barber already exists with this email', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(pass, salt);

    const barber = await Barber.create({
        shopId,
        name,
        email,
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
            email: barber.email,
            shop: shop.name,
        },
    });
});
exports.registerPushToken = asyncHandler(async (req, res) => {
    const { token } = req.body; // The push token from the frontend
    const userId = req.user._id; // The ID of the authenticated user
    const userType = req.userType; // The type of the authenticated user (e.g., 'Barber', 'Owner', 'User')

    if (!token) {
        throw new ApiError('Push token is required', 400);
    }

 

    const user = await Barber.findById(userId);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    user.expopushtoken = token;
    await user.save();

    res.status(200).json({
        success: true,
        message: `${userType} Expo Push Token registered successfully.`,
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
    const { name, email, pass } = req.body; // Pass can also be updated

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
    barber.email = email || barber.email;

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
            email: updatedBarber.email,
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

exports.rate = asyncHandler(async (req, res) => {
  try {
    const { rating, hid } = req.body;
    const barber = await Barber.findById(req.params.id);

    if (!barber) {
      return res.status(404).json({ message: 'Barber not found' });
    }

    const history = await History.findById(hid);
    if (!history) {
      return res.status(404).json({ message: 'History not found' });
    }

    if (history.isRated) {
      return res.status(400).json({ message: 'Service already rated' });
    }

    // Mark history as rated
    history.isRated = true;
    history.rating = rating;

    // Update barber rating using cumulative average
     const customersServed = barber.customersServed;

    // Update the barber's average rating
    barber.rating = ((barber.rating * (customersServed - 1)) + rating) / customersServed;
    // Save updates
    await history.save();
    await barber.save();

    console.log("Rating updated successfully");
    res.status(200).json({ message: 'Rating submitted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while rating' });
  }
});
