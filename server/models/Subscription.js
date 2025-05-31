const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubscriptionSchema = new Schema({
    name: { // e.g., "Basic Plan", "Premium Plan"
        type: String,
        required: true,
        unique: true
    },
    price: { // Price of the subscription plan
        type: Number,
        required: true
    },
    duration: { // Duration of the plan in days, months, or years
        value: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            enum: ['days', 'months', 'years'],
            required: true
        }
    },
    features: [{ // List of features included in this plan
        type: String
    }],
    isActive: { // Whether this subscription plan is currently available
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
