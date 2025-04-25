const mongoose = require('mongoose');

// Barber History Schema
const BarberHistorySchema = new mongoose.Schema({
  services: { type: [String], required: true },
  totalCost: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

// Barber Schema
const BarberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  totalCustomersServed: { type: Number, default: 0 },
  totalStarsEarned: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  ratings: { type: [Number], default: [] },
  history: { type: [BarberHistorySchema], default: [] }
});

// Queue Schema
const QueueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    uid: { type: String },
    services: [{ type: String }],
    code: { type: String, required: true },
    totalCost: { type: Number }
  },
  { timestamps: true }
);

// Shop Schema with trial tracking, queues, barbers, and the new address field
// Shop Schema with trial tracking, queues, barbers, address, and rateList fields
const ShopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  expoPushToken: { type: String },
  address: {
    textData: { type: String, default: "" },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  // Existing fields...
  trialStatus: { type: String, default: 'trial' }, // you can continue using this if needed
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: { type: Date }, // New field to store when the trial/subscription ends
  queues: [QueueSchema],
  barbers: [BarberSchema],
  rateList: {
    type: [
      {
        service: { type: String, required: true },
        price: { type: Number, required: true }
      }
    ],
    default: []
  }
});


const Shop = mongoose.model("Shop", ShopSchema);
module.exports = Shop;
