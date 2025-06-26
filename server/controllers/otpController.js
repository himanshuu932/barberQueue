// controllers/otpController.js
const mailjet = require('node-mailjet').apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);
const { asyncHandler, ApiError } = require('../utils/errorHandler');
const { generateOTP, storeOTP, verifyOTP } = require('../utils/otpStore');

exports.sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError('Please enter a valid email address', 400);
  }

  // Generate and store OTP
  const otp = generateOTP();
  storeOTP(email, otp);

  // Send OTP via Mailjet
  try {
    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.EMAIL_FROM,
            Name: process.env.AppNameForEmail,
          },
          To: [
            {
              Email: email
            }
          ],
          Subject: 'Your Verification OTP',
          TextPart: `Your OTP is: ${otp}`,
          HTMLPart: `<h3>Your OTP is: <strong>${otp}</strong></h3><p>This OTP will expire in 10 minutes.</p>`
        }
      ]
    });

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Mailjet error:', error);
    throw new ApiError('Failed to send OTP', 500);
  }
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError('Email and OTP are required', 400);
  }

  const isValid = verifyOTP(email, otp);
  if (!isValid) {
    throw new ApiError('Invalid OTP or OTP expired', 400);
  }

  res.json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      email,
      verified: true
    }
  });
});