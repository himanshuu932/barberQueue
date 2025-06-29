// utils/otpStore.js
const otpStore = new Map();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const storeOTP = (email, otp) => {
  // Store OTP with expiration time (10 minutes from now)
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + 600000 // 10 minutes in milliseconds
  });
};

const verifyOTP = (email, otp) => {
  const storedData = otpStore.get(email);
  
  if (!storedData || storedData.otp !== otp) {
    return false;
  }
  
  // Check if OTP has expired
  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  
  // Clean up
  otpStore.delete(email);
  return true;
};

// Cleanup expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 3600000); // Run cleanup every hour

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP
};