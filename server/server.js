// server.js
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const http = require('http'); // Required for Socket.IO
const { Server } = require('socket.io'); // Import Server from socket.io

const connectDB = require('./config/db');
const { globalErrorHandler } = require('./utils/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();
const server = http.createServer(app); // Create HTTP server from Express app

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development. Restrict in production.
        methods: ["GET", "POST"]
    }
});

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Client emits 'join_shop_queue' to join a specific shop's room
    socket.on('join_shop_queue', (shopId) => {
        if (shopId) {
            socket.join(shopId.toString()); // Join the room named after the shopId
            console.log(`Socket ${socket.id} joined room: ${shopId}`);
        } else {
            console.warn(`Socket ${socket.id} attempted to join room with invalid shopId`);
        }
    });

    // Client emits 'leave_shop_queue' to leave a specific shop's room
    socket.on('leave_shop_queue', (shopId) => {
        if (shopId) {
            socket.leave(shopId.toString()); // Leave the room named after the shopId
            console.log(`Socket ${socket.id} left room: ${shopId}`);
        }
    });

    // In server.js - io.on('connection')
socket.on('join_user_room', (userId) => {
  if (userId) {
    socket.join(userId.toString());
    console.log(`Socket ${socket.id} joined user room: ${userId}`);
  }
});

socket.on('leave_user_room', (userId) => {
  if (userId) {
    socket.leave(userId.toString());
    console.log(`Socket ${socket.id} left user room: ${userId}`);
  }
});

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
    });
});


// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// --- Load Mongoose Models ---
require('./models/Admin');
require('./models/Barber');
require('./models/History');
require('./models/Owner');
require('./models/Queue');
require('./models/Service');
require('./models/Shop');
require('./models/Subscription');
require('./models/User');

// --- Import Routes ---
const userRoutes = require('./routes/userRoutes');
const otpRoutes = require('./routes/otpRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const shopRoutes = require('./routes/shopRoutes');
const barberRoutes = require('./routes/barberRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const queueRoutes = require('./routes/queueRoutes')(io); // Pass io to queue routes
const historyRoutes = require('./routes/historyRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

// --- Define API Routes ---
app.use('/api/users', userRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/queue', queueRoutes); // Queue routes will now use the io instance
app.use('/api/history', historyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// --- Root Route ---
app.get('/', (req, res) => {
    res.send('API is running...');
});
app.get('/ping', (req, res) => {
  res.send('pong');
});

// --- Error Handling Middleware ---
app.use(globalErrorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { // Use `server.listen` instead of `app.listen`
    console.log(`Server running in ${process.env.NODE_ENV || "local"} mode on port ${PORT}`);
    setInterval(() => {
  fetch('https://numbr-exq6.onrender.com/ping')
    .then(() => console.log('Pinged self!'))
    .catch(() => console.log('Self ping failed.'));
}, 1000 * 60 * 10); // Every 10 mins

});
