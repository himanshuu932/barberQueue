// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/otpController');
const { asyncHandler } = require('../utils/errorHandler');

router.post('/send', asyncHandler(sendOTP));
router.post('/verify', asyncHandler(verifyOTP));

module.exports = router;