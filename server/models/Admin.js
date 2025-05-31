// models/Admin.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: { // Admin might log in with email
        type: String,
        required: true,
        unique: true
    },
    pass: { // Storing hashed password
        type: String,
        required: true
    },
    phone: { // Optional phone number for contact or MFA
        type: String,
        required: false,
        unique: true,
        sparse: true // Allows multiple documents to have null or missing phone
    },
    role: { // To define different levels of admin access (e.g., 'superadmin', 'support', 'billing')
        type: String,
        enum: ['superadmin', 'moderator', 'support'], // Example roles
        default: 'moderator'
    },
    lastLogin: { // To track last login time
        type: Date
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

module.exports = mongoose.model('Admin', AdminSchema);