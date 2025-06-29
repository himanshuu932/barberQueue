// models/Queue.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QueueSchema = new Schema({
    shop: { // The shop this queue belongs to
        type: Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    barber: { // The barber for whom the customer is queued (optional, if general queue)
        type: Schema.Types.ObjectId,
        ref: 'Barber',
        required: false
    },
    userId: { // Reference to the User document (optional for non-registered users)
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    customerName: { // Name for non-registered users
        type: String,
        required: function() {
            return !this.userId; // Required if userId is not present
        }
    },
    customerPhone: { // Phone for non-registered users
        type: String,
        required: false
    },
    services: [{ // Array of services the customer is getting
      name: {
            type: String,
            required: false
        },
        price: {
            type: Number,
            required: false,
            min: 0
        }
    }],
    orderOrQueueNumber: { // Position in the queue
        type: Number,
        required: true
    },
    uniqueCode: { // 6-digit unique code for the booking/queue entry
        type: String,
        required: true,
        unique: true,
        minlength: 6,
        maxlength: 6
    },
    totalCost: { // Calculated total cost for the services in this queue entry
        type: Number,
        required: true
    },
    status: { 
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Queue', QueueSchema);
