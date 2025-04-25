const express = require('express');
// Adjust the path to your Shop model
const {
  login,
  signup,
  getAllHistory,
  getHistoryByDate,
  getProfile,
  registerForPushNotifications,
  getAllShops,
  updateAddress,
  getRateList,
  addRateListItem,
  updateRateListItem,
  deleteRateListItem,
  getCoordinates,updateProfile
} = require('../controllers/shopControllers');

const router = express.Router();


router.post('/signup', signup);
router.post('/login', login);
router.post('/update-address', updateAddress);
router.get('/profile', getProfile);
router.get('/shops', getAllShops);
router.patch('/profile/update', updateProfile);
// History Routes
router.get('/history/:date', getHistoryByDate);
router.get('/history', getAllHistory);

// Push Notification
router.post('/register-push-token', registerForPushNotifications);

// Rate List Routes
router.get('/rateList', getRateList);
router.post('/rateList/add', addRateListItem);
router.put('/rateList/update', updateRateListItem);
router.delete('/rateList/delete', deleteRateListItem);
router.get("/coordinates", getCoordinates);
module.exports = router;
