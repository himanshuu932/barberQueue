// models/User.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    pass: { // Storing hashed password, not plain text
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
        required: false // Optional, as user might not enable notifications
    },
    pinnedShop: { // Reference to a Shop that the user has pinned
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: false
    },
    subscription: { // Subscription details for the user
        status: { // current subscription status for the user
            type: String,
            enum: ['active', 'trial', 'expired'],
            default: 'trial', // New users might start on a trial
            required: true
        },
        lastPlanInfo: { // Details of the last subscribed plan (if not trial)
            transactionId: {
                type: String,
                required: function() {
                    return this.subscription.status !== 'trial';
                }
            },
            plan: { // Reference to the Subscription plan document
                type: Schema.Types.ObjectId,
                ref: 'Subscription',
                required: function() {
                    return this.subscription.status !== 'trial';
                }
            },
            startDate: {
                type: Date,
                required: function() {
                    return this.subscription.status !== 'trial';
                }
            },
            endDate: {
                type: Date,
                required: function() {
                    return this.subscription.status !== 'trial';
                }
            }
        },
        trialEndDate: { // End date for the trial period
            type: Date,
            required: function() {
                return this.subscription.status === 'trial';
            }
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
