// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = "your-secret-key"; // Use an environment variable in production

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const MONGO_URI = 'mongodb+srv://himanshuu932:88087408601@cluster0.lu2g8bw.mongodb.net/barber?retryWrites=true&w=majority&appName=Cluster0';
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
});
const User = mongoose.model("User", UserSchema);

/* ===============================
   Queue Schema and Model
   =============================== */
const QueueSchema = new mongoose.Schema({
  name: { type: String, required: true },
});
const Queue = mongoose.model("Queue", QueueSchema);

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
    const token = jwt.sign({ id: newUser._id, email: newUser.email }, SECRET_KEY, { expiresIn: '1h' });
    res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email } });
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
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===============================
   Queue Endpoints (Existing)
   =============================== */
// GET endpoint to fetch the current queue length and names
app.get("/queue", async (req, res) => {
  try {
    const queueItems = await Queue.find({}, 'name');
    const queueLength = queueItems.length;
    const names = queueItems.map(item => item.name);
    res.json({ queueLength, names });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST endpoint to add a person to the queue (increment)
app.post("/queue", async (req, res) => {
  try {
    const { name } = req.body;
    const newPerson = new Queue({ name: name || "Dummy Person" });
    await newPerson.save();
    res.status(201).json(newPerson);
  } catch (error) {
    console.error("Error adding to queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE endpoint to remove a person from the queue (decrement)
app.delete("/queue", async (req, res) => {
  try {
    const removedPerson = await Queue.findOneAndDelete();
    if (removedPerson) {
      res.json({ message: "Person removed" });
    } else {
      res.json({ message: "Queue is empty" });
    }
  } catch (error) {
    console.error("Error removing person:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
