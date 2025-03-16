const User = require('../models/User');
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const { Expo } = require("expo-server-sdk");
const expo = new Expo();
const SECRET_KEY = process.env.SECRET; 

exports.checkNotifications = async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await User.findById(uid);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.notification.enabled) {
      return res.json({
        message: "Pending notification found",
        notification: {
          title: user.notification.title,
          body: user.notification.body,
          data: user.notification.data,
        },
      });
    } else {
      return res.json({ message: "No pending notifications" });
    }
  } catch (error) {
    console.error("Error checking notifications:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetNotification = async (req, res) => {
  try {
    const { uid } = req.body;
    console.log("reset uid", uid);
    const user = await User.findById(uid);
   
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.notification = {
      enabled: false,
      title: null,
      body: null,
      data: null,
    };

    await user.save();

    return res.json({ message: "Notification reset successfully" });
  } catch (error) {
    console.error("Error resetting notification:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetPendingRating = async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: "User ID (uid) is required" });
    }

    const user = await User.findByIdAndUpdate(
      uid,
      {
        $set: {
          "pendingRating.status": false,
          "pendingRating.bid": null,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ message: "Pending rating reset successfully", user });
  } catch (error) {
    console.error("Error resetting pending rating:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  console.log(req.body);
  try {
    const { email, password } = req.body;
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    // Find the user
    const user = await User.findOne({ email });
    // In production, compare hashed passwords with bcrypt.compare()
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Generate a JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, pinnedShop: user.pinnedShop } });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    // Create new user
    const newUser = new User({ name, email, password });
    await newUser.save();
    // Generate a JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      SECRET_KEY
    );
    res
      .status(201)
      .json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email } });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.history = async (req, res) => {
  try {
    const { service } = req.body;
    if (!service) {
      return res.status(400).json({ error: "Service type is required" });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.history.push({ service, date: new Date() });
    await user.save();
    res.json({ message: "History updated", history: user.history });
  } catch (error) {
    console.error("Error updating history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateDetails = async (req, res) => {
  try {
    const { uid, name, email } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "User ID (uid) is required." });
    }
    // Ensure that at least one field is provided for update.
    if (!name && !email) {
      return res
        .status(400)
        .json({ error: "At least one field (name or email) must be provided for update." });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Find the user by ID and update, returning the new document.
    const updatedUser = await User.findByIdAndUpdate(uid, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.fetchDetails = async (req, res) => {
  try {
    const { uid } = req.query;
    console.log("uid", uid);
    const user = await User.findById(uid).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.registerForPushNotifications = async (req, res) => {
  try {
    const { uid, token } = req.body;
    if (!uid || !token) {
      return res.status(400).json({ error: "UID and token are required" });
    }
    const user = await User.findByIdAndUpdate(uid, { expoPushToken: token }, { new: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Push token registered", user });
  } catch (error) {
    console.error("Error registering push token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.sendPushNotification = async (req, res) => {
  try {
    const { uid, title, body, data } = req.body;
    if (!uid || !title || !body) {
      return res.status(400).json({ error: "UID, title, and body are required" });
    }
    const user = await User.findById(uid);
    if (!user || !user.expoPushToken) {
      return res.status(404).json({ error: "User not found or push token not registered" });
    }
    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      return res.status(400).json({ error: "Invalid Expo push token" });
    }
   
    // Update notification data
    user.notification = {
      enabled: true,
      title,
      body,
      data: data || {}
    };
    
    await user.save();
    // Build the notification message.
    const message = {
      to: user.expoPushToken,
      sound: "default",
      title: title,
      body: body,
      channelId: "default",
      priority: "high",
      _displayInForeground: true
    };

    // Only add data if it's provided.
    if (data) {
      message.data = data;
    }

    const messages = [ message ];

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    res.json({ message: "Notification sent", tickets });
    //io.emit('pushNotification', { message: message, uid: uid });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// New function to update the user's pinned shop
exports.updatePinnedShop = async (req, res) => {
  try {
    const { uid, pinnedShop } = req.body;
    if (!uid || !pinnedShop) {
      return res.status(400).json({ error: "User ID (uid) and pinned shop are required" });
    }
    const user = await User.findByIdAndUpdate(
      uid,
      { pinnedShop: pinnedShop },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Pinned shop updated successfully", user });
  } catch (error) {
    console.error("Error updating pinned shop:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
