// controllers/deliveryPlanController.js
const express      = require('express');
const mongoose     = require('mongoose');
const router       = express.Router();
const DeliveryPlan = require('../models/DeliveryPlan');
const requireAuth  = require('../middleware/requireAuth');

router.use(requireAuth);

/**
 * POST /api/delivery-plans
 * Create one DeliveryPlan entry:
 *   { tripId, customerId, shipTo, requiredQty }
 */
router.post('/', async (req, res, next) => {
  try {
    const { tripId, customerId, shipTo, requiredQty } = req.body;
    if (!tripId || !customerId || !shipTo || requiredQty == null) {
      return res.status(400).json({ error: 'tripId, customerId, shipTo, requiredQty are required' });
    }
    if (
      !mongoose.Types.ObjectId.isValid(tripId) ||
      !mongoose.Types.ObjectId.isValid(customerId)
    ) {
      return res.status(400).json({ error: 'Invalid tripId or customerId' });
    }
    const plan = await DeliveryPlan.create({ tripId, customerId, shipTo, requiredQty });
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/delivery-plans/:tripId
 * List all plan entries for a trip
 */
router.get('/:tripId', async (req, res, next) => {
  try {
    const { tripId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid tripId' });
    }
    const plans = await DeliveryPlan.find({ tripId });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
