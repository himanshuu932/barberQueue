const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const { Expo } = require("expo-server-sdk");

const Shop = require("./models/Shop"); // Shop model now includes embedded queues and barbers
const User = require("./models/User"); // Assume User remains a separate model
const expo = new Expo();
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;
const SECRET_KEY = "your-secret-key";
const shopRoutes = require("./routes/shopRoutes");
const userRoutes = require("./routes/userRoutes");

// Middleware
app.use(cors());
app.use(express.json());
const MONGO_URI ="mongodb+srv://himanshuu932:88087408601@cluster0.lu2g8bw.mongodb.net/barber?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));


// Create an HTTP server
const server = http.createServer(app);
app.use('/', userRoutes);
app.use('/shop', shopRoutes);
// Initialize Socket.io with CORS settings
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (update in production)
    methods: ["GET", "POST"],
  },
});

/* ===============================
   Socket.io Connection Handling
   =============================== */
io.on("connection", (socket) => {
  console.log(`DEBUG: Client connected with socket id: ${socket.id}`);

  // Client should join a shop-specific queue room
  socket.on("joinShopQueue", (data) => {
    const { shopId } = data;
    if (shopId) {
      const room = `queue_${shopId}`;
      socket.join(room);
      console.log(`DEBUG: Socket ${socket.id} joined room ${room}`);
    }
  });

  socket.on("joinQueue", (data) => {
    const { shopId } = data;
    const room = shopId ? `queue_${shopId}` : "queue";
    console.log(`DEBUG: Received "joinQueue" from ${socket.id} with data:`, data);
    io.to(room).emit("queueUpdated", { message: `Queue has been updated for shop ${shopId}` });
  });

  socket.on("leaveQueue", (data) => {
    const { shopId } = data;
    const room = shopId ? `queue_${shopId}` : "queue";
    console.log(`DEBUG: Received "leaveQueue" from ${socket.id} with data:`, data);
    io.to(room).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
  });

  socket.on("moveDownQueue", (data) => {
    const { shopId } = data;
    const room = shopId ? `queue_${shopId}` : "queue";
    console.log(`DEBUG: Received "moveDownQueue" from ${socket.id} with data:`, data);
    io.to(room).emit("queueUpdated", { message: `Queue has been updated for shop ${shopId}` });
  });

  socket.on("removedFromQueue", (data) => {
    const { shopId } = data;
    const room = shopId ? `queue_${shopId}` : "queue";
    console.log(`DEBUG: Received "removedFromQueue" from ${socket.id} with data:`, data);
    io.to(room).emit("queueUpdated", { message: `Queue has been updated for shop ${shopId}` });
  });

  socket.on("disconnect", () => {
    console.log(`DEBUG: Socket ${socket.id} disconnected.`);
  });
});

/* ===============================
   Queue Endpoints (Embedded in Shop)
   =============================== */

// GET /queue?shopId=...
app.get("/queue", async (req, res) => {
  try {
    const { shopId } = req.query;
    console.log(`DEBUG: Fetching queue for shop ${shopId}`);
  // const shopId='67d47642f94d06880c222925';
    if (!shopId) return res.status(400).json({ error: "shopId is required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    // Sort queues by order
    const sortedQueue = shop.queues.sort((a, b) => a.order - b.order);
    const data = sortedQueue.map(item => ({
      _id: item._id,
      uid: item.uid,
      name: item.name,
      order: item.order,
      code: item.code,
      services: item.services,
      totalCost: item.totalCost
    }));

    res.json({ queueLength: data.length, data });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /queue
app.post("/queue", async (req, res) => {
  console.log("Queue", req.body);
  try {
    let { shopId, name, id, services, code, totalCost } = req.body;
    if (!shopId) return res.status(400).json({ error: "shopId is required" });
    if (services && !Array.isArray(services)) {
      services = [services];
    }
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    // Determine the new order value based on the current queue
    const lastOrder = shop.queues.reduce((max, item) => Math.max(max, item.order), 0);
    const newOrder = lastOrder + 1;

    const newQueueItem = {
      name,
      order: newOrder,
      uid: id,
      code,
      services,
      totalCost,
    };

    shop.queues.push(newQueueItem);
    await shop.save();
    io.to(`queue_${shopId}`).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
    res.status(201).json(newQueueItem);
  } catch (error) {
    console.error("Error adding to queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /queue/move
app.patch("/queue/move", async (req, res) => {
  try {
    const { shopId, id } = req.body;
    if (!shopId || !id) return res.status(400).json({ error: "shopId and id are required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    // Ensure the queue is sorted by order
    shop.queues.sort((a, b) => a.order - b.order);
    const index = shop.queues.findIndex(item => item._id.toString() === id);
    if (index === -1) return res.status(404).json({ error: "Queue item not found" });
    if (index === shop.queues.length - 1)
      return res.status(400).json({ error: "Item is already at the end of the queue" });

    const currentItem = shop.queues[index];
    const nextItem = shop.queues[index + 1];
    const temp = currentItem.order;
    currentItem.order = nextItem.order;
    nextItem.order = temp;

    await shop.save();
    io.to(`queue_${shopId}`).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
    res.json({ message: "Person moved down successfully" });
  } catch (error) {
    console.error("Error moving person down:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /update-services
app.patch("/update-services", async (req, res) => {
  try {
    const { shopId, uid, services, totalCost } = req.body;
    if (!shopId || !uid || !services || !Array.isArray(services) || typeof totalCost !== "number") {
      return res.status(400).json({ error: "shopId, uid, services (array), and totalCost (number) are required" });
    }
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const queueItem = shop.queues.find(item => item.uid === uid);
    if (!queueItem) return res.status(404).json({ error: "Queue item not found" });

    queueItem.services = services;
    queueItem.totalCost = totalCost;
    await shop.save();
    io.to(`queue_${shopId}`).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
    res.json({
      message: "Services updated successfully",
      updatedUser: queueItem,
    });
  } catch (error) {
    console.error("Error updating services:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /queue
app.delete("/queue", async (req, res) => {
  try {
    const { shopId, uid } = req.query;
    if (!shopId) return res.status(400).json({ error: "shopId is required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    let removedItem;
    if (uid) {
      const index = shop.queues.findIndex(item => item.uid === uid);
      if (index === -1) return res.status(404).json({ error: "Queue item not found with the given uid" });
      removedItem = shop.queues.splice(index, 1);
    } else {
      shop.queues.sort((a, b) => a.order - b.order);
      removedItem = shop.queues.shift();
    }
    await shop.save();
    io.to(`queue_${shopId}`).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
    res.status(200).json({ message: "Person removed", removed: removedItem });
  } catch (error) {
    console.error("Error removing person:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/barbers", async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) return res.status(400).json({ error: "shopId is required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    res.json(shop.barbers);
  } catch (error) {
    console.error("Error fetching barbers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /barber/:uid?shopId=...
app.get("/barber/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { shopId } = req.query;
    if (!shopId) return res.status(400).json({ error: "shopId is required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const barber = shop.barbers.find(b => b._id.toString() === uid);
    if (!barber) return res.status(404).json({ error: "Barber not found" });

    res.json(barber);
  } catch (error) {
    console.error("Error fetching barber details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /barber/signup
app.post("/barber/signup", async (req, res) => {
  try {
    const { shopId, name, email, phone, password } = req.body;
    if (!shopId || !name || !email || !phone || !password) {
      return res.status(400).json({ error: "All fields including shopId are required" });
    }
    
    // Check across all shops if a barber with this email already exists
    const existingBarber = await Shop.findOne({ "barbers.email": email });
    if (existingBarber) {
      return res.status(400).json({ error: "Barber already exists" });
    }
    
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const newBarber = { name, email, phone, password };
    shop.barbers.push(newBarber);
    await shop.save();

    const addedBarber = shop.barbers[shop.barbers.length - 1];
    const token = jwt.sign(
      { id: addedBarber._id, email: addedBarber.email, role: "barber" },
      SECRET_KEY
    );
    
    res.status(201).json({
      token,
      shopId: shop._id,
      barber: {
        id: addedBarber._id,
        name: addedBarber.name,
        email: addedBarber.email,
        phone: addedBarber.phone
      }
    });
  } catch (error) {
    console.error("Barber signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// POST /barber/login
app.post("/barber/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    // Automatically find the shop that contains a barber with the given email
    const shop = await Shop.findOne({ "barbers.email": email });
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    //console.log(shop);
    const barber = shop.barbers.find(b => b.email === email);
    if (!barber || barber.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign(
      { id: barber._id, email: barber.email, role: "barber" },
      SECRET_KEY
    );
    
    res.json({
      token,
      shopId: shop._id,
      barber: {
        id: barber._id,
        name: barber.name,
        email: barber.email,
        phone: barber.phone
      }
    });
  } catch (error) {
    console.error("Barber login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Barber Auth Middleware remains similar
const barberAuthMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
    if (decoded.role !== "barber") {
      return res.status(401).json({ error: "Invalid token for barber." });
    }
    req.barber = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// POST /barber/add-history
app.post("/barber/add-history",  async (req, res) => {
  try {
    const { shopId, userId, barberId, service, cost } = req.body;
    if (!shopId) return res.status(400).json({ error: "shopId is required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const barber = shop.barbers.id(barberId);
    if (!barber) return res.status(404).json({ error: "Barber not found" });

    // Convert the service input to a string (comma separated if array)
    const serviceString = Array.isArray(service) ? service.join(", ") : service;
    
    // Update barber's history (note: splitting the service string back to array for the barber schema)
    barber.history.push({
      services: serviceString.split(",").map(s => s.trim()),
      totalCost: cost,
      date: new Date()
    });
    barber.totalCustomersServed += 1;
    
    // Update shop's history (using a single service string)
    shop.history.push({
      service: serviceString,
      date: new Date(),
      cost: cost
    });

    // Remove user from the shop's queue if present
    const queueIndex = shop.queues.findIndex(item => item.uid === userId);
    let removedPerson = null;
    if (queueIndex !== -1) {
      removedPerson = shop.queues.splice(queueIndex, 1);
    }
    
    // Save shop with updated barber history, shop history, and queue changes
    await shop.save();

    // Update the user's history
    if (userId.endsWith("=")) {
      console.log("Dummy user detected, skipping history update");
      return res.status(200).json({ message: "Dummy user skipped history update" });
    }
    const user = await User.findById(userId);
    if (user) {
      user.history.push({
        service: serviceString,
        date: new Date(),
        cost: cost
      });
      user.pendingRating.status = true;
    user.pendingRating.bid = barberId;
      await user.save();
    }

    // Emit an update to any connected clients for real-time UI updates
    io.to(`queue_${shopId}`).emit("queueUpdated", { message: `Queue updated for shop ${shopId}` });
    
    res.status(200).json({
      ok: true,
      message: "History updated for barber, shop, and user, and user removed from queue",
      barberHistory: barber.history,
      shopHistory: shop.history,
      removedPerson,
    });
  } catch (error) {
    console.error("Error in /barber/add-history route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// PATCH /barber/profile
app.patch("/barber/profile", async (req, res) => {
  try {
    const { shopId, bid, name, email, phone, password } = req.body;
    if (!shopId || !bid) return res.status(400).json({ error: "shopId and barber ID (bid) are required." });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const barber = shop.barbers.id(bid);
    if (!barber) return res.status(404).json({ error: "Barber not found." });

    if (name) barber.name = name;
    if (email) barber.email = email;
    if (phone) barber.phone = phone;
    if (password) barber.password = password; // Remember to hash in production
    await shop.save();
    res.json({ message: "Barber profile updated successfully.", barber });
  } catch (error) {
    console.error("Error updating barber profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /barber/profile
app.delete("/barber/profile", async (req, res) => {
  try {
    console.log(req.body);
    const { shopId, bid } = req.body;

    if (!shopId || !bid) return res.status(400).json({ error: "shopId and barber id (bid) are required" });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const barber = shop.barbers.id(bid);
    if (!barber) return res.status(404).json({ error: "Barber not found" });
    shop.barbers.pull({ _id: bid });
    await shop.save();
    res.status(200).json({ message: "Barber deleted successfully" });
  } catch (error) {
    console.error("Error deleting barber:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /barber/rate
app.post("/barber/rate", async (req, res) => {
  try {
    const { shopId, rating, uid } = req.body;
    if (!shopId || !rating || !uid) {
      return res.status(400).json({ error: "shopId, rating, and uid are required" });
    }
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const user = await User.findById(uid);
    if (!user || !user.pendingRating.status || !user.pendingRating.bid) {
      return res.status(400).json({ error: "No pending rating" });
    }
    const barberId = user.pendingRating.bid;
    const barber = shop.barbers.id(barberId);
    if (!barber) return res.status(404).json({ error: "Barber not found" });

    barber.ratings.push(rating);
    barber.totalStarsEarned += rating;
    barber.totalRatings += 1;
    await shop.save();

    // Reset the pending rating in the user model
    user.pendingRating.status = false;
    user.pendingRating.bid = null;
    await user.save();

    res.json({
      message: "Rating submitted",
      averageRating: barber.totalStarsEarned / barber.totalRatings,
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Start the Server
   =============================== */
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
