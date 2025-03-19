const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');
const dotenv = require("dotenv");
dotenv.config();
const JWT_SECRET = process.env.SECRET;

exports.signup = async (req, res) => {
  try {
    const { name, email, password, expoPushToken, address } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Check if a shop with the same email already exists
    const existingShop = await Shop.findOne({ email });
    if (existingShop) {
      return res.status(400).json({ message: 'A shop with this email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new shop document; trialStatus and trialStartDate use their default values.
    // Include the address if provided.
    const newShop = new Shop({
      name,
      email,
      password: hashedPassword,
      expoPushToken,
      address: address || undefined
    });

    await newShop.save();

    // Create a JWT token for authentication
    const token = jwt.sign(
      { id: newShop._id, email: newShop.email },
      JWT_SECRET
     
    );

    res.status(201).json({ token, shop: newShop });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup.' });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // Find the shop by email
    const shop = await Shop.findOne({ email });
    if (!shop) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: shop._id, email: shop.email },
      JWT_SECRET
    );

    // Send only required fields
    res.json({
      token,
      shop: {
        id: shop._id,
        name: shop.name,
        trialStatus: shop.trialStatus,
        trialStartDate: shop.trialStartDate,
        address: shop.address
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const shopId = req.query.id; 

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required in query parameters" });
    }

    const shop = await Shop.findById(shopId).select('name email trialStatus trialStartDate address');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.json(shop);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

// Get History of a Particular Day
exports.getHistoryByDate = async (req, res) => {
  try {
    const shopId = req.query.id; // Extract shop ID from query
    const { date } = req.params; // Extract date from route params

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required in query parameters" });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const filteredHistory = shop.history.filter(entry =>
      new Date(entry.date).toDateString() === new Date(date).toDateString()
    );

    res.json(filteredHistory);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: "Server error while fetching history" });
  }
};

// Get Complete History
exports.getAllHistory = async (req, res) => {
  try {
    const shopId = req.query.id; // Extract shop ID from query

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required in query parameters" });
    }

    const shop = await Shop.findById(shopId).select('history');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.json(shop.history);
  } catch (error) {
    console.error('Error fetching complete history:', error);
    res.status(500).json({ message: "Server error while fetching complete history" });
  }
};

exports.registerForPushNotifications = async (req, res) => {
  try {
    const { uid, token } = req.body;
    if (!uid || !token) {
      return res.status(400).json({ error: "UID and token are required" });
    }
    const user = await Shop.findByIdAndUpdate(uid, { expoPushToken: token }, { new: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Push token registered", user });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// New Function: Get Details of All Shops
exports.getAllShops = async (req, res) => {
  console.log("Fetching all shops...");
  try {
    const shops = await Shop.find().select('_id name email trialStatus trialStartDate address');
    res.json(shops);
  } catch (error) {
    console.error("Error fetching all shops:", error);
    res.status(500).json({ message: "Server error while fetching shops." });
  }
};
exports.updateAddress = async (req, res) => {
  try {
    console.log("Updating address...");
     // Shop ID passed as a query parameter
    const { shopId ,address } = req.body; // Expecting an object with textData, x, and y

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required in query parameters" });
    }

    if (!address || typeof address !== 'object') {
      return res.status(400).json({ message: "A valid address object is required." });
    }

    // Optionally, add further validations on address fields if needed

    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { address },
      { new: true }
    );

    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.json({ message: "Address updated successfully", shop: updatedShop });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ message: "Server error while updating address." });
  }
};
// New function: Get Rate List for a shop
exports.getRateList = async (req, res) => {
  try {
    // Assume the shop ID is sent as a query parameter
    const shopId = req.query.id;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }
    const shop = await Shop.findById(shopId).select('rateList');
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json(shop.rateList);
  } catch (error) {
    console.error("Error fetching rate list:", error);
    res.status(500).json({ message: "Server error while fetching rate list." });
  }
};

// New function: Add a Rate List Item
exports.addRateListItem = async (req, res) => {
  try {
    const { shopId, service, price } = req.body;
    if (!shopId || !service || price == null) {
      return res.status(400).json({ message: "Shop ID, service, and price are required." });
    }
    const newItem = { service, price };
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $push: { rateList: newItem } },
      { new: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ message: "Rate list item added successfully.", rateList: updatedShop.rateList });
  } catch (error) {
    console.error("Error adding rate list item:", error);
    res.status(500).json({ message: "Server error while adding rate list item." });
  }
};

// New function: Update a Rate List Item
exports.updateRateListItem = async (req, res) => {
  try {
    const { shopId, rateItemId, service, price } = req.body;
    if (!shopId || !rateItemId || !service || price == null) {
      return res.status(400).json({ message: "Shop ID, rate item ID, service, and price are required." });
    }
    // Using the positional operator to update the matching rateList item
    const updatedShop = await Shop.findOneAndUpdate(
      { _id: shopId, "rateList._id": rateItemId },
      { $set: { "rateList.$.service": service, "rateList.$.price": price } },
      { new: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ message: "Shop or rate list item not found." });
    }
    res.json({ message: "Rate list item updated successfully.", rateList: updatedShop.rateList });
  } catch (error) {
    console.error("Error updating rate list item:", error);
    res.status(500).json({ message: "Server error while updating rate list item." });
  }
};

// New function: Delete a Rate List Item
exports.deleteRateListItem = async (req, res) => {
  try {
    const { shopId, rateItemId } = req.body;
    if (!shopId || !rateItemId) {
      return res.status(400).json({ message: "Shop ID and rate item ID are required." });
    }
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $pull: { rateList: { _id: rateItemId } } },
      { new: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ message: "Shop or rate list item not found." });
    }
    res.json({ message: "Rate list item deleted successfully.", rateList: updatedShop.rateList });
  } catch (error) {
    console.error("Error deleting rate list item:", error);
    res.status(500).json({ message: "Server error while deleting rate list item." });
  }
};
exports.getCoordinates = async (req, res) => {
  try {
    // Extract shop ID from query parameters
    const shopId = req.query.id;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    // Fetch the shop document, selecting only the address field
    const shop = await Shop.findById(shopId).select("address");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }

    // Ensure the address exists and contains x and y coordinates
    if (!shop.address || typeof shop.address !== "object") {
      return res.status(400).json({ message: "Address data is not available." });
    }
    
    const { x, y } = shop.address;
    if (x === undefined || y === undefined) {
      return res.status(404).json({ message: "Coordinates not found in address." });
    }

    // Return only the x and y coordinates
    res.json({ x, y });
  } catch (error) {
    console.error("Error fetching coordinates:", error);
    res.status(500).json({ message: "Server error while fetching coordinates." });
  }
};
// In shopControllers.js

exports.updateProfile = async (req, res) => {
  try {
    const { shopId, name, email, address } = req.body;
    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required." });
    }

    // Build an update object with only the provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (address && typeof address === 'object') updateData.address = address;

    // Find and update the shop document
    const updatedShop = await Shop.findByIdAndUpdate(shopId, updateData, {
      new: true,
    });
    if (!updatedShop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ message: "Profile updated successfully", shop: updatedShop });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error while updating profile." });
  }
};
