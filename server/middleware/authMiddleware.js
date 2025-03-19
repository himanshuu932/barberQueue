const Shop = require('../models/Shop'); // Adjust the path as needed

const checkTrialMiddleware = async (req, res, next) => {
  // Get shopId from query or body
  const shopId = req.query.shopId || req.body.shopId;
  if (!shopId) {
    return res.status(400).json({ error: "shopId is required" });
  }

  try {
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // If trialEndDate is set and the current date is past it, mark the trial as expired and block the action.
    if (shop.trialEndDate && new Date() > shop.trialEndDate) {
      // Optionally, update the shop document to record that the trial is expired.
      // For example, if your model has a field `trialExpired` or `trialStatus`, you can update it:
      if (!shop.trialExpired) { // or check shop.trialStatus !== 'expired'
       // shop.trialExpired = true;          // if using a boolean flag
         shop.trialStatus = 'expired';     // if using a status string
        await shop.save();
      }
      return res.status(403).json({ error: "Trial or subscription period has ended. Please renew to access queue features." });
    }

    // Otherwise, proceed to the next middleware/route handler.
    next();
  } catch (error) {
    console.error("Error in trial check middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = checkTrialMiddleware;
