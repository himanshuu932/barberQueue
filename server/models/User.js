const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  expoPushToken: { type: String },
  history: [{ 
    service: String, 
    date: Date,
    cost: Number
  }],
  pendingRating: {
    status: { type: Boolean, default: false },
    bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', default: null }
  },
  notification: { // New field
    enabled: { type: Boolean, default: false },
    title: String,
    body: String,
    data: mongoose.Schema.Types.Mixed
  },
  // New pinnedShop field references a Shop document
  pinnedShop: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
    default: null 
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
