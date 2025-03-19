const Shop = require('../models/Shop'); // Adjust the path as needed

const checkTrialMiddleware = async (req, res, next) => {
  // Get shopId from query or body (adjust according to your endpoint design)
  const shopId = req.query.shopId || req.body.shopId;
  if (!shopId) {
    return res.status(400).json({ error: "shopId is required" });
  }

  try {
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // If trialEndDate is set and the current date is past it, block the action
    if (shop.trialEndDate && new Date() > shop.trialEndDate) {
      return res.status(403).json({ error: "Trial or subscription period has ended. Please renew to access queue features." });
    }

    // Otherwise, proceed to the next middleware/route handler
    next();
  } catch (error) {
    console.error("Error in trial check middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = checkTrialMiddleware;
