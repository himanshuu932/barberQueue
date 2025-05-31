// models/Shop.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShopSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    owner: { // Reference to the Owner of the shop
        type: Schema.Types.ObjectId,
        ref: 'Owner',
        required: true
    },
    address: { // Embedded document for address details
        fullDetails: {
            type: String,
            required: true
        },
        coordinates: { // GeoJSON for location (e.g., [longitude, latitude])
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        }
    },
    photos: [{ // Array of URLs or references to image assets
        type: String // Assuming URLs for now
    }],
    rating: { // Overall rating of the shop
        type: Number,
        min: 1,
        max: 5,
        default: 0
    },
    // Services offered by this shop, now including price specific to this shop
    services: [{
        service: { // Reference to the Service document
            type: Schema.Types.ObjectId,
            ref: 'Service',
            required: true
        },
        price: { // Price for THIS specific service at THIS specific shop
            type: Number,
            required: true
        }
    }],
    // Barbers working at this shop (references to Barber documents)
    barbers: [{
        type: Schema.Types.ObjectId,
        ref: 'Barber'
    }],
    subscription: { // Subscription details for the shop
        status: { // current subscription status
            type: String,
            enum: ['active', 'trial', 'expired'],
            default: 'trial', // New shops start on trial
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
        trialEndDate: {
            type: Date,
            required: function() {
                return this.subscription.status === 'trial';
            }
        }
    }
}, {
    timestamps: true
});


ShopSchema.index({
    'address.coordinates': '2dsphere'
});

module.exports = mongoose.model('Shop', ShopSchema);
