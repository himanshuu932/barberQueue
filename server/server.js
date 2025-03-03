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
  history: [{ 
    service: String, 
    date: Date,
    cost: Number  // Added cost field
  }],
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
    services: [{ type: String }], 
    code:{ type: String, required: true },
    totalCost: { type: Number } 
  },
  { timestamps: true }
);
const Queue = mongoose.model("Queue", QueueSchema);

/* ===============================
   Socket.io Connection Handling
   =============================== */
   io.on("connection", (socket) => {
    console.log(`DEBUG: Client connected with socket id: ${socket.id}`);
    
    socket.join("queue");
    console.log(`DEBUG: Socket ${socket.id} joined room "queue".`);
  
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`DEBUG: Socket ${socket.id} disconnected.`);
    });
  
    // Listen for custom events (e.g., queue updates)
    socket.on("joinQueue", (data) => {
      console.log(`DEBUG: Received "joinQueue" event from ${socket.id} with data:`, data);
      io.to("queue").emit("queueUpdated", { message: "Queue has been updated" });
      console.log(`DEBUG: Emitted "queueUpdated" event to room "queue" after joinQueue from ${socket.id}.`);
    });
  
    socket.on("leaveQueue", (data) => {
      console.log(`DEBUG: Received "leaveQueue" event from ${socket.id} with data:`, data);
      io.to("queue").emit("queueUpdated", { message: "Queue updated" });
      console.log(`DEBUG: Emitted "queueUpdated" event to room "queue" after leaveQueue from ${socket.id}.`);
    });
  
    socket.on("moveDownQueue", (data) => {
      console.log(`DEBUG: Received "moveDownQueue" event from ${socket.id} with data:`, data);
      io.to("queue").emit("queueUpdated", { message: "Queue has been updated" });
      console.log(`DEBUG: Emitted "queueUpdated" event to room "queue" after moveDownQueue from ${socket.id}.`);
    });
  
    socket.on("markedServed", (data) => {
      console.log(`DEBUG: Received "markedServed" event from ${socket.id} with data:`, data);
      // Optionally, trigger a notification here as well.
    });
  
    socket.on("removedFromQueue", (data) => {
      console.log(`DEBUG: Received "removedFromQueue" event from ${socket.id} with data:`, data);
      io.emit("queueUpdated", { message: "Queue has been updated" });
      console.log(`DEBUG: Emitted "queueUpdated" event to all clients after removedFromQueue from ${socket.id}.`);
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
    // Create new user/
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
    const queueItems = await Queue.find({}, "name order uid _id services code totalCost")
      .sort({ order: 1 });

    const data = queueItems.map(item => ({
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

// POST endpoint to add a person to the queue
app.post("/queue", async (req, res) => {
  console.log("Queue", req.body);
  try {
    // Destructure values and default to null if they are undefined.
    // Using nullish coalescing operator (??) to allow falsy values (like 0) to pass.
    let { name, id, services, code, totalCost } = req.body;
    name = name ?? null;
    id = id ?? null;
    services = services ?? null;
    code = code ?? null;
    totalCost = totalCost ?? null;

    // If services is provided but not an array, you might want to convert it.
    if (services && !Array.isArray(services)) {
      services = [services];
    }

    // Get the new order based on the last document in the queue.
    const lastInQueue = await Queue.findOne().sort({ order: -1 });
    const newOrder = lastInQueue ? lastInQueue.order + 1 : 1;

    // Create the new queue entry.
    const newPerson = new Queue({
      name,
      order: newOrder,
      uid: id,
      code,
      services,
      totalCost,
    });

    await newPerson.save();
    io.emit("queueUpdated", { message: "Queue updated" });
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

// PATCH endpoint to update user's services in the queue
app.patch("/update-services", async (req, res) => {
 // console.log("Update services", req.body);
  try {
    const { uid, services, totalCost } = req.body;

    // Validate input
    if (!uid || !services || !Array.isArray(services) || typeof totalCost !== "number") {
      return res.status(400).json({ error: "UID, services (array), and totalCost (number) are required" });
    }

    // Find the user in the queue
    const userInQueue = await Queue.findOne({ uid });

    if (!userInQueue) {
      return res.status(404).json({ error: "User not found in the queue" });
    }

    // Update the user's services and total cost
    userInQueue.services = services;
    userInQueue.totalCost = totalCost;

    // Save the updated user
    await userInQueue.save();

    // Emit a WebSocket event to notify all clients about the updated queue
    io.emit("queueUpdated", { message: "Queue has been updated" });

    // Respond with the updated user
    res.json({
      message: "Services updated successfully",
      updatedUser: userInQueue,
    });
  } catch (error) {
    console.error("Error updating services:", error);
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


/* ===============================
   Barber Schema and Model
   =============================== */
   const BarberHistorySchema = new mongoose.Schema({
    services: { type: [String], required: true },
    totalCost: { type: Number, required: true },
    date: { type: Date, default: Date.now }
  });
  
  const BarberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    totalCustomersServed: { type: Number, default: 0 },
    totalStarsEarned: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    ratings: { type: [Number], default: [] },
    history: { type: [BarberHistorySchema], default: [] }
  });
  
  const Barber = mongoose.model("Barber", BarberSchema);
/* ===============================
   Get All Barbers Endpoint
   =============================== */
   app.get("/barbers", async (req, res) => {
    try {
      const barbers = await Barber.find({}, "-password -__v");
      res.json(barbers);
    } catch (error) {
      console.error("Error fetching barbers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  /* ===============================
   Fetch Barber Details by UID
   =============================== */
app.get("/barber/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Validate UID
    if (!mongoose.isValidObjectId(uid)) {
      return res.status(400).json({ error: "Invalid Barber ID" });
    }

    // Find the barber by UID
    const barber = await Barber.findById(uid).select("-password -__v"); // Exclude sensitive fields
    if (!barber) {
      return res.status(404).json({ error: "Barber not found" });
    }

    // Return the barber details
    res.json(barber);
  } catch (error) {
    console.error("Error fetching barber details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
  /* ===============================
     Mark Customer as Served Endpoint
     =============================== */
     /* ===============================
   Barber Auth Middleware
   =============================== */
   /* ===============================
   Barber Signup Endpoint
   =============================== */
app.post("/barber/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingBarber = await Barber.findOne({ email });
    if (existingBarber) {
      return res.status(400).json({ error: "Barber already exists" });
    }

    const newBarber = new Barber({ name, email, phone, password });
    await newBarber.save();

    const token = jwt.sign(
      { id: newBarber._id, email: newBarber.email, role: "barber" },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      token,
      barber: {
        id: newBarber._id,
        name: newBarber.name,
        email: newBarber.email,
        phone: newBarber.phone
      }
    });
  } catch (error) {
    console.error("Barber signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Barber Login Endpoint
   =============================== */
app.post("/barber/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const barber = await Barber.findOne({ email });
    if (!barber || barber.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: barber._id, email: barber.email, role: "barber" },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({
      token,
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
app.post("/barber/add-history", barberAuthMiddleware, async (req, res) => {
  try {
    const { userId, barberId, service, cost } = req.body;

    console.log("Received request to add history:", { userId, barberId, service, cost });

    // Validate required fields
  

    // Handle dummy users (mobile users without account)
    if (userId.endsWith("=")) {
      console.log("Dummy user detected, skipping history update");
      return res.status(200).json({ message: "Dummy user skipped history update" });
    }
    if (!userId || !barberId || !service || !cost) {
      console.error("Missing required fields in request body");
      return res.status(400).json({ error: "User ID, Barber ID, service, and cost are required" });
    }
    // Find the user and barber
    console.log("Fetching user and barber from the database...");
    const user = await User.findById(userId);
    const barber = await Barber.findById(barberId);

    if (!user) {
      console.error("User not found with ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }
    if (!barber) {
      console.error("Barber not found with ID:", barberId);
      return res.status(404).json({ error: "Barber not found" });
    }

    console.log("User and barber found:", { user: user._id, barber: barber._id });

    // If service is an array, join the elements into a single comma-separated string
    const serviceString = Array.isArray(service) ? service.join(", ") : service;
    console.log("Service string:", serviceString);

    // Update user history
    console.log("Updating user history...");
    user.history.push({ service: serviceString, cost, date: new Date() });
    await user.save();
    console.log("User history updated successfully");

    // Update barber history and statistics
    console.log("Updating barber history and statistics...");
    barber.history.push({ services: serviceString, totalCost: cost, date: new Date() });
    barber.totalCustomersServed += 1;
    await barber.save();
    console.log("Barber history and statistics updated successfully");

    // Remove the user from the queue
    console.log("Removing user from the queue...");
    const removedPerson = await Queue.findOneAndDelete({ uid: userId });
    if (!removedPerson) {
      console.error("User not found in the queue with UID:", userId);
      return res.status(404).json({ error: "User not found in the queue" });
    }
    console.log("User removed from the queue:", removedPerson);

    // Emit WebSocket event to notify clients of queue updates
    console.log("Emitting queueUpdated event via WebSocket...");
    io.emit("queueUpdated", { message: "Queue has been updated" });

    // Respond with success
    console.log("Request completed successfully");
    res.status(200).json({
      ok:true,
      message: "History updated and user removed from queue",
      userHistory: user.history,
      barberHistory: barber.history,
      removedPerson,
    });
  } catch (error) {
    console.error("Error in /barber/add-history route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
  
  /* ===============================
     Rate Barber Endpoint
     =============================== */
  app.post("/barber/rate", authMiddleware, async (req, res) => {
    try {
      const { barberId, rating } = req.body;
      if (!barberId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating data" });
      }
  
      const barber = await Barber.findById(barberId);
      if (!barber) {
        return res.status(404).json({ error: "Barber not found" });
      }
  
      barber.ratings.push(rating);
      barber.totalStarsEarned += rating;
      barber.totalRatings += 1;
      await barber.save();
  
      res.json({
        message: "Rating submitted",
        averageRating: barber.totalStarsEarned / barber.totalRatings
      });
    } catch (error) {
      console.error("Error submitting rating:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
