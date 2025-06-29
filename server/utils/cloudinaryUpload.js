// utils/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create storage engine for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barber_shops',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  },
});

const parser = multer({ storage: storage });

// Middleware for single file upload
const uploadSingleImage = (fieldName) => {
  return parser.single(fieldName);
};

// Middleware for multiple file uploads
const uploadMultipleImages = (fieldName, maxCount = 5) => {
  return parser.array(fieldName, maxCount);
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  cloudinary
};