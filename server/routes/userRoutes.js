const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { checkNotifications, resetNotification, resetPendingRating ,login,signup,history,updateDetails,fetchDetails,registerForPushNotifications,sendPushNotification,updatePinnedShop} = require('../controllers/userController');

router.get('/check-notifications',  checkNotifications);

router.post('/reset-notification',  resetNotification);

// Route to reset pending rating
router.post('/reset-pendingRating',  resetPendingRating);
router.post("/signup",signup );
router.post("/login", login);
router.post("/update-pinnedShop", updatePinnedShop);
router.post("/history",  history);
router.patch("/profile", updateDetails);
router.get("/profile",  fetchDetails);
router.post("/register-push-token", registerForPushNotifications);
router.post("/notify",sendPushNotification );
 

module.exports = router;
