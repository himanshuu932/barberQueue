// utils/generateCode.js

const generateUniqueCode = () => {
    // Generate a 6-digit number and convert to string
    // Ensure it's padded with leading zeros if necessary
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = generateUniqueCode;
