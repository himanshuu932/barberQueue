// models/Barber.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BarberSchema = new Schema({
    shopId: { // Reference to the shop where the barber works
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    pass: { // Storing hashed password (if barbers have logins)
        type: String,
        required: false // Optional if barbers don't have direct logins
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    expopushtoken: { // For push notifications
        type: String,
        required: false
    },
    rating: { // Individual rating for the barber
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    customersServed: { // Denormalized count for quick access
        type: Number,
        default: 0
    },
    activeTaking: { // Indicates if the barber is currently active and taking new customers
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Barber', BarberSchema);
