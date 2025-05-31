// utils/errorHandler.js

// A utility to wrap async controller functions to catch errors
const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Custom error class for API errors
class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // Mark as operational error
        Error.captureStackTrace(this, this.constructor);
    }
}

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
    // Default error status and message
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Something went wrong on the server.';

    // Handle specific Mongoose errors
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 400;
        message = `Resource not found with ID of ${err.value}`;
    }

    if (err.code === 11000) { // Duplicate key error
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate field value: ${field}. Please use another value.`;
    }

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: message,
        // In development, you might want to send the stack trace
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = { asyncHandler, ApiError, globalErrorHandler };
