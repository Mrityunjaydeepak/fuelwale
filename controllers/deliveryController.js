// controllers/deliveryController.js
const express      = require('express');
const mongoose     = require('mongoose');
const router       = express.Router();
const DeliveryPlan = require('../models/DeliveryPlan');
const Delivery     = require('../models/Delivery');
const requireAuth  = require('../middleware/requireAuth');

router.use(requireAuth);

/**
 * GET /api/deliveries/pending/:tripId
 * List plan items not yet delivered
 */
router.get('/pending/:tripId', async (req, res, next) => {
  try {
    const { tripId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid tripId' });
    }
    const plans = await DeliveryPlan.find({ tripId });
    const done  = await Delivery.find({ tripId }).select('customerId');
    const doneSet = new Set(done.map(d => d.customerId.toString()));

    const pending = plans
      .filter(p => !doneSet.has(p.customerId.toString()))
      .map(p => ({
        _id:          p._id,
        customerId:   p.customerId,
        shipTo:       p.shipTo,
        requiredQty:  p.requiredQty,
        // you can populate customer name, phone, etc. if you want
      }));

    res.json(pending);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/completed/:tripId
 * List actual deliveries done
 */
router.get('/completed/:tripId', async (req, res, next) => {
  try {
    const { tripId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid tripId' });
    }
    const completed = await Delivery.find({ tripId })
      .select('customerId shipTo qty rate deliveredAt dcNo')
      .sort({ deliveredAt: 1 });
    res.json(completed);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/deliveries
 * Record a delivery
 */
router.post('/', async (req, res, next) => {
  try {
    const { tripId, customerId, shipTo, qty, rate } = req.body;
    if (
      !tripId ||
      !customerId ||
      !shipTo ||
      qty == null ||
      rate == null
    ) {
      return res.status(400).json({
        error: 'tripId, customerId, shipTo, qty and rate are required'
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(tripId) ||
      !mongoose.Types.ObjectId.isValid(customerId)
    ) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Check inventory
    const inv = await require('../models/BowserInventory')
      .findOne({ vehicleNo: (await require('../models/Trip').findById(tripId)).vehicleNo });
    if (!inv || inv.balanceLiters < qty) {
      return res.status(400).json({ error: 'Insufficient vehicle stock' });
    }

    // Create DC No (simple increment or timestamp-based)
    const dcNo = `DC-${Date.now()}`;

    const delivery = await Delivery.create({
      tripId, customerId, shipTo, qty, rate, dcNo
    });

    // Decrement inventory
    inv.balanceLiters -= qty;
    await inv.save();

    // Stub WhatsApp
    console.log(
      `WhatsApp to customer ${customerId}: Delivered ${qty}L @${rate}, amount ₹${qty*rate}, DC No:${dcNo}`
    );

    res.json({ dcNo });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
