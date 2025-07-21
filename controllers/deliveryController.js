// controllers/deliveryController.js

const express      = require('express');
const mongoose     = require('mongoose');
const router       = express.Router();
const requireAuth  = require('../middleware/requireAuth');

const Trip         = require('../models/Trip');
const Order        = require('../models/Order');
const DeliveryPlan = require('../models/DeliveryPlan');
const Delivery     = require('../models/Delivery');
const BowserInventory = require('../models/BowserInventory');

router.use(requireAuth);

/**
 * GET /api/deliveries/pending/:tripId
 * List plan items not yet delivered, including orderId
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
        _id:         p._id,
        orderId:     p.orderId,
        customerId:  p.customerId,
        shipTo:      p.shipTo,
        requiredQty: p.requiredQty
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
      .select('orderId customerId shipTo qty rate deliveredAt dcNo')
      .sort({ deliveredAt: 1 });

    res.json(completed);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/deliveries
 * Record a delivery (now requires orderId)
 */
router.post('/', async (req, res, next) => {
  try {
    const { tripId, orderId, customerId, shipTo, qty, rate } = req.body;
    if (!tripId || !orderId || !customerId || !shipTo || qty == null || rate == null) {
      return res.status(400).json({
        error: 'tripId, orderId, customerId, shipTo, qty and rate are required'
      });
    }
    // Validate all IDs
    for (let [name, id] of [['tripId', tripId], ['orderId', orderId], ['customerId', customerId]]) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `${name} is not a valid ID` });
      }
    }

    // Verify the Order belongs to the given customer
    const order = await Order.findById(orderId);
    if (!order || order.customer.toString() !== customerId) {
      return res.status(400).json({ error: 'orderId does not match that customer' });
    }

    // Check vehicle inventory
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const inv = await BowserInventory.findOne({ vehicleNo: trip.vehicleNo });
    if (!inv || inv.balanceLiters < qty) {
      return res.status(400).json({ error: 'Insufficient vehicle stock' });
    }

    // Generate DC No
    const dcNo = `DC-${Date.now()}`;

    // Persist delivery
    const delivery = await Delivery.create({
      tripId,
      orderId,
      customerId,
      shipTo,
      qty,
      rate,
      dcNo
    });

    // Decrement inventory
    inv.balanceLiters -= qty;
    await inv.save();

    // Stub WhatsApp
    console.log(
      `WhatsApp to customer ${customerId}: Delivered ${qty}L @${rate}, ` +
      `amount ₹${(qty*rate).toFixed(2)}, DC No:${dcNo}`
    );

    res.status(201).json({ dcNo, deliveryId: delivery._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
