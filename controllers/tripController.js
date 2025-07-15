// controllers/tripController.js

const express       = require('express');
const mongoose      = require('mongoose');
const router        = express.Router();
const Trip          = require('../models/Trip');
const Vehicle       = require('../models/Vehicle');
const Order         = require('../models/Order');
const DeliveryPlan  = require('../models/DeliveryPlan');
const requireAuth   = require('../middleware/requireAuth');

// Stub helpers
async function getDieselOpening(vehicleNo) { return 1200; }
async function getTodayDeliveries(driverId) {
  return [
    { customer: 'CUST001', qty: 300 },
    { customer: 'CUST002', qty: 200 }
  ];
}

router.use(requireAuth);

/**
 * GET /api/trips
 */
router.get('/', async (req, res, next) => {
  try {
    const trips = await Trip.find();
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }
    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/assigned/:driverId
 */
router.get('/assigned/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driverId' });
    }
    const trips = await Trip.find({
      driverId,
      status: 'ASSIGNED'
    }).sort({ createdAt: 1 });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/active/:driverId
 */
router.get('/active/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driverId' });
    }
    const trip = await Trip.findOne({ driverId, status: 'ACTIVE' });
    if (!trip) return res.status(404).json({ error: 'No active trip found' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/assign
 */
router.post('/assign', async (req, res, next) => {
  try {
    const { driverId, vehicleNo, capacity, routeId } = req.body;
    if (!driverId || !vehicleNo || capacity == null || !routeId) {
      return res.status(400).json({
        error: 'driverId, vehicleNo, capacity and routeId are required'
      });
    }
    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ error: 'Invalid routeId' });
    }
    // block if active or assigned exists
    const conflict = await Trip.findOne({
      driverId,
      vehicleNo,
      status: { $in: ['ASSIGNED', 'ACTIVE'] }
    });
    if (conflict) {
      return res.status(400).json({
        error: 'Cannot assign: existing trip in progress for this driver/vehicle'
      });
    }
    // create trip
    const trip = await Trip.create({
      driverId,
      vehicleNo,
      capacity,
      routeId,
      assigned: true,
      status: 'ASSIGNED'
    });

    // auto‐seed delivery plan: fetch pending orders for this route
    const orders = await Order.find({ routeId, status: 'PENDING' });
    if (orders.length) {
      const plans = orders.map(o => ({
        tripId:      trip._id,
        customerId:  o.customerId,
        shipTo:      o.shipTo,
        requiredQty: o.qty
      }));
      await DeliveryPlan.insertMany(plans);
    }

    res.status(201).json({ message: 'Trip assigned', tripId: trip._id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const {
      driverId, vehicleNo,
      startKm, totalizerStart,
      routeId, remarks
    } = req.body;

    if (
      !driverId || !vehicleNo ||
      startKm == null || totalizerStart == null ||
      !routeId
    ) {
      return res.status(400).json({
        error: 'driverId, vehicleNo, startKm, totalizerStart and routeId are required'
      });
    }
    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ error: 'Invalid routeId' });
    }

    const trip = await Trip.findOne({
      driverId, vehicleNo, status: 'ASSIGNED'
    });
    if (!trip) {
      return res.status(403).json({
        error: 'No assigned trip to start. Please check back later.'
      });
    }

    trip.startKm        = startKm;
    trip.totalizerStart = totalizerStart;
    trip.routeId        = routeId;
    trip.remarks        = remarks;
    trip.dieselOpening  = await getDieselOpening(vehicleNo);
    trip.loginTime      = new Date();
    trip.status         = 'ACTIVE';
    await trip.save();

    const deliveries = await getTodayDeliveries(driverId);

    res.json({
      message:       'Trip started successfully',
      tripId:        trip._id,
      dieselOpening: trip.dieselOpening,
      deliveries
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { tripId, endKm, totalizerEnd } = req.body;
    if (!tripId || endKm == null || totalizerEnd == null) {
      return res.status(400).json({
        error: 'tripId, endKm, and totalizerEnd are required'
      });
    }
    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'No active trip found to end' });
    }
    trip.endKm         = endKm;
    trip.totalizerEnd  = totalizerEnd;
    trip.logoutTime    = new Date();
    trip.status        = 'COMPLETED';
    await trip.save();

    await Vehicle.findOneAndUpdate(
      { licensePlate: trip.vehicleNo },
      { lastKm: endKm, lastTotalizer: totalizerEnd }
    );

    res.json({ message: 'Trip successfully closed' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Trip.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
