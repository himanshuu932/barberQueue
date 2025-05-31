// models/Service.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true // Service names like "Haircut", "Shave" should be unique globally
    }
    // 'price' is defined in the Shop schema for each specific service offered by that shop.
}, {
    timestamps: true
});

module.exports = mongoose.model('Service', ServiceSchema);
