
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HistorySchema = new Schema({
    user: { // User who received the service (required, as it's a history of a completed service)
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    customerName: {
  type: String,
  required: false
},
    barber: { // Barber who provided the service
        type: Schema.Types.ObjectId,
        ref: 'Barber',
        required: true
    },
    shop: { // Shop where the service was provided
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    services: [{ // Now an array of services, each with a reference and quantity
        service: { // The specific service performed
            type: Schema.Types.ObjectId,
            ref: 'Service',
            required: true
        },
        name: {
             type: String,
             default: "any service"
        },

        price: {
            type: Number,
            default: 10,
        },

        quantity: { // Quantity of this service (e.g., 2 haircuts)
            type: Number,
            default: 1
        }
    }],
    date: { // Date and time when the service was completed
        type: Date,
        default: Date.now,
        required: true
    },
    totalCost: { // The total cost of this service instance
        type: Number,
        required: true
    },
    isRated:{type:Boolean,required:false,default:false},
    rating: { // User's rating for this specific service instance (optional)
        type: Number,
        min: 0,
        max: 5,
        required: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('History', HistorySchema);
