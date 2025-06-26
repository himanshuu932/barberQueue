// models/Owner.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OwnerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    pass: { // Storing hashed password
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    expopushtoken: { // For push notifications
        type: String,
        required: false
    },
    shops: [{ // Array of shops owned by this owner
        type: Schema.Types.ObjectId,
        ref: 'Shop'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Owner', OwnerSchema);
