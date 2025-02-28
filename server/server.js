const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = "your-secret-key"; // Use an environment variable in production

// Middleware
app.use(cors());
app.use(express.json());

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (update this in production)
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB
const MONGO_URI =
  'mongodb+srv://himanshuu932:88087408601@cluster0.lu2g8bw.mongodb.net/barber?retryWrites=true&w=majority&appName=Cluster0';
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

/* ===============================
   User Schema and Model
   =============================== */
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // In production, hash your passwords!
  expoPushToken: { type: String }, // New field for push notifications
  history: [{ service: String, date: Date }],
});
const User = mongoose.model("User", UserSchema);

/* ===============================
   Queue Schema and Model
   =============================== */
const QueueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    uid: { type: String },
  },
  { timestamps: true }
);
const Queue = mongoose.model("Queue", QueueSchema);

/* ===============================
   Socket.io Connection Handling
   =============================== */
io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A client disconnected:", socket.id);
  });

  // Listen for custom events (e.g., queue updates)
  socket.on("joinQueue", (data) => {
    console.log("User joined queue:", data);
    io.emit("queueUpdated", { message: "Queue has been updated" });
  });

  socket.on("leaveQueue", (data) => {
    console.log("User left queue:", data);
    io.emit("queueUpdated", { message: "Queue has been updated" });
  });

  socket.on("moveDownQueue", (data) => {
    console.log("User moved down in queue:", data);
    io.emit("queueUpdated", { message: "Queue has been updated" });
  });

  socket.on("markedServed", (data) => {
    console.log("User marked served:", data);
    // Optionally, you can trigger a notification here as well.
  });

  socket.on("removedFromQueue", (data) => {
    console.log("User removed from queue:", data);
    io.emit("queueUpdated", { message: "Queue has been updated" });
  });
});

/* ===============================
   API Endpoints
   =============================== */

// Endpoint to register the user's Expo push token
app.post("/register-push-token", async (req, res) => {
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
});

// Endpoint to send a push notification
app.post("/notify", async (req, res) => {
  try {
    const { uid, title, body } = req.body;
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

    const messages = [
      {
        to: user.expoPushToken,
        sound: "default",
        title: title,
        body: body,
      },
    ];

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    res.json({ message: "Notification sent", tickets });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Signup Endpoint
   =============================== */
app.post("/signup", async (req, res) => {
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
      SECRET_KEY,
      { expiresIn: "1h" }
    );
    res
      .status(201)
      .json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email } });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Login Endpoint
   =============================== */
app.post("/login", async (req, res) => {
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
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Queue Endpoints
   =============================== */

// GET endpoint to fetch the current queue length and names (sorted by order)
app.get("/queue", async (req, res) => {
  try {
    const queueItems = await Queue.find({}, "name order uid _id").sort({ order: 1 });
    const queueLength = queueItems.length;
    const data = queueItems.map((item) => ({
      _id: item._id,
      uid: item.uid,
      name: item.name,
      order: item.order,
    }));
    res.json({ queueLength, data });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST endpoint to add a person to the queue
app.post("/queue", async (req, res) => {
  try {
    const { name, id } = req.body;
    // Find the document with the highest valid order value.
    const lastInQueue = await Queue.findOne({ order: { $exists: true } }).sort({ order: -1 });
    let newOrder = 1;
    if (lastInQueue && !isNaN(lastInQueue.order)) {
      newOrder = Number(lastInQueue.order) + 1;
    }
    const newPerson = new Queue({ name: name || "Dummy Person", order: newOrder, uid: id || null });
    await newPerson.save();
    // Emit a WebSocket event to notify all clients about the updated queue
    io.emit("queueUpdated", { message: "Queue has been updated" });
    res.status(201).json(newPerson);
  } catch (error) {
    console.error("Error adding to queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH endpoint to move a person one position down in the queue.
app.patch("/queue/move", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    // Find the target person's document
    const person = await Queue.findOne({ _id: id });
    if (!person) {
      return res.status(404).json({ error: "Person not found in the queue" });
    }
    // Find the person immediately after in order
    const nextPerson = await Queue.findOne({ order: { $gt: person.order } }).sort({ order: 1 });
    if (!nextPerson) {
      return res.status(400).json({ error: "Person is already at the end of the queue" });
    }
    // Swap their order values
    const tempOrder = person.order;
    person.order = nextPerson.order;
    nextPerson.order = tempOrder;
    await person.save();
    await nextPerson.save();
    // Emit WebSocket events
    io.emit("userMovedDown", { id });
    io.emit("queueUpdated", { message: "Queue has been updated" });
    res.json({ message: "Person moved down successfully" });
  } catch (error) {
    console.error("Error moving person down:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE endpoint to remove a person from the queue.
app.delete("/queue", async (req, res) => {
  try {
    let removedPerson;
    console.log("Removing with uid:", req.query.uid);
    if (req.query.uid) {
      removedPerson = await Queue.findOneAndDelete({ uid: req.query.uid });
      // Emit a WebSocket event to notify the user that they were removed
      io.emit("userRemoved", { uid: req.query.uid });
    } else {
      removedPerson = await Queue.findOneAndDelete({}, null, { sort: { order: 1 } });
    }
    if (removedPerson) {
      // Broadcast the updated queue to all clients
      io.emit("queueUpdated", { message: "Queue has been updated" });
      res.json({ message: "Person removed", removed: removedPerson });
    } else {
      res.json({ message: "Queue is empty" });
    }
  } catch (error) {
    console.error("Error removing person:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Profile Endpoint (Protected)
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/history", authMiddleware, async (req, res) => {
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
});

app.post("/barber/add-history", authMiddleware, async (req, res) => {
  try {
    const { userId, service } = req.body;
    if (!userId || !service) {
      return res.status(400).json({ error: "User ID and service are required" });
    }
    if (userId.endsWith("=")) {
      return res.status(200).json({
        message: "User marked as served (skipped history update)",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.history.push({ service, date: new Date() });
    await user.save();
    return res.status(200).json({
      message: "User marked as served and history updated successfully",
      history: user.history,
    });
  } catch (error) {
    console.error("Error updating service history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
