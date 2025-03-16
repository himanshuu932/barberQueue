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
  // New address field: an object containing textData, x, and y
  address: {
    textData: { type: String, default: "" },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  history: [
    {
      service: String,
      date: Date,
      cost: Number
    }
  ],
  notification: {
    enabled: { type: Boolean, default: false },
    title: String,
    body: String,
    data: mongoose.Schema.Types.Mixed
  },
  trialStatus: { type: String, default: 'trial' },
  trialStartDate: { type: Date, default: Date.now },
  queues: [QueueSchema],
  barbers: [BarberSchema],
  // New rateList field: an array of objects each containing service and price
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
