// controllers/loadingController.js

const express         = require('express');
const mongoose        = require('mongoose');
const router          = express.Router();
const LoadingMaster   = require('../models/LoadingMaster');
const LoadingAuth     = require('../models/LoadingAuth');
const Loading         = require('../models/Loading');
const BowserInventory = require('../models/BowserInventory');
const Trip            = require('../models/Trip');
const requireAuth     = require('../middleware/requireAuth');
const Vehicle = require('../models/Vehicle');

router.use(requireAuth);

/**
 * GET /api/loadings/stations
 * List all route⇄station mappings (for admin)
 */
router.get('/stations', async (req, res, next) => {
  try {
    const masters = await LoadingMaster.find()
      .populate('routeId', 'name')
      .populate('stationId', 'name');
    res.json(masters);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loadings/stations
 * Map a station to a route
 * body: { routeId, stationId, order? }
 */
router.post('/stations', async (req, res, next) => {
  try {
    const { routeId, stationId, order } = req.body;
    if (!routeId || !stationId) {
      return res
        .status(400)
        .json({ error: 'routeId and stationId are required' });
    }
    if (
      !mongoose.Types.ObjectId.isValid(routeId) ||
      !mongoose.Types.ObjectId.isValid(stationId)
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid routeId or stationId' });
    }
    const exists = await LoadingMaster.findOne({ routeId, stationId });
    if (exists) {
      return res
        .status(400)
        .json({ error: 'This station is already mapped to that route' });
    }
    const master = await LoadingMaster.create({
      routeId,
      stationId,
      order: order || 0
    });
    res.status(201).json(master);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/loadings/stations/:id
 * Remove a mapping
 */
router.delete('/stations/:id', async (req, res, next) => {
  try {
    const deleted = await LoadingMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/loadings/stations/:routeId
 * List the stations for a given route
 */
router.get('/stations/:routeId', async (req, res, next) => {
  try {
    const { routeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ error: 'Invalid routeId' });
    }
    const masters = await LoadingMaster
      .find({ routeId })
      .sort({ order: 1 })
      .populate('stationId', 'name');
    const stations = masters.map(m => ({
      id:   m.stationId._id,
      name: m.stationId.name
    }));
    res.json(stations);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loadings/generate-code
 */
router.post('/generate-code', async (req, res, next) => {
  try {
    const { tripId } = req.body;
    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Valid tripId required' });
    }
    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Trip not active' });
    }
    const inv = await BowserInventory.findOne({ vehicleNo: trip.vehicleNo });
    if (!inv) {
      return res.status(400).json({ error: 'No inventory for vehicle' });
    }

    let codeRequired = false;
    let code;
    if (inv.balanceLiters < trip.capacity) {
      codeRequired = true;
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await LoadingAuth.findOneAndUpdate(
        { tripId },
        { code, expiresAt, used: false },
        { upsert: true, new: true }
      );
      // In dev, we return the code so you can console.log it
    }
    res.json({ codeRequired, code });
  } catch (err) {
    next(err);
  }
});

// GET /api/loadings/code/:tripId — DEV ONLY
router.get('/code/:tripId', async (req, res, next) => {
  try {
    const auth = await LoadingAuth.findOne({ tripId: req.params.tripId });
    if (!auth) return res.status(404).json({ error: 'No code found' });
    res.json({ code: auth.code });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loadings/verify-code
 */
router.post('/verify-code', async (req, res, next) => {
  try {
    const { tripId, code } = req.body;
    if (
      !tripId || !mongoose.Types.ObjectId.isValid(tripId) ||
      !code
    ) {
      return res.status(400).json({ error: 'tripId and code are required' });
    }
    const auth = await LoadingAuth.findOne({ tripId });
    if (
      !auth ||
      auth.used ||
      auth.expiresAt < new Date() ||
      auth.code !== code
    ) {
      return res.status(403).json({ error: 'Invalid or expired code' });
    }
    auth.used = true;
    await auth.save();
    res.json({ message: 'Code verified' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loadings
 */
/**
 * POST /api/loadings
 * Record a loading fill and update inventory.
 */



router.post('/', async (req, res, next) => {
  try {
    const { tripId, code, stationId, product, qty, vehicleId } = req.body;

    if (!tripId || !stationId || !product || qty == null) {
      return res.status(400).json({
        error: 'tripId, stationId, product, and qty are required'
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(tripId) ||
      !mongoose.Types.ObjectId.isValid(stationId)
    ) {
      return res.status(400).json({ error: 'Invalid tripId or stationId' });
    }
    if (vehicleId && !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicleId' });
    }

    // 1) Fetch trip
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // 2) Handle auth code if one was generated
    const auth = await LoadingAuth.findOne({ tripId });
    if (auth) {
      if (!code) return res.status(400).json({ error: 'code is required' });
      if (auth.used || auth.expiresAt < new Date() || auth.code !== code) {
        return res.status(403).json({ error: 'Invalid or expired code' });
      }
      auth.used = true;
      await auth.save();
    }

    // 3) Lookup vehicle correctly
    let vehicle = null;
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId);
    }
    if (!vehicle) {
      // fallback by vehicleNo stored on Trip
      vehicle = await Vehicle.findOne({ vehicleNo: trip.vehicleNo });
      // If you need case-insensitive matching:
      // vehicle = await Vehicle.findOne({ vehicleNo: trip.vehicleNo }).collation({ locale: 'en', strength: 2 });
    }
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // 4) Create Loading with correct fields
    const loading = await Loading.create({
      tripId,
      stationId,
      product,
      qty,
      vehicleNo: vehicle.vehicleNo,   // ✅ correct field
      depotCd:   vehicle.depotCd      // ✅ correct field
    });

    // 5) Deduct from bowser inventory
    await BowserInventory.findOneAndUpdate(
      { vehicleNo: trip.vehicleNo },
      { $inc: { balanceLiters: -qty } }
    );

    return res.status(201).json({
      message: 'Loading recorded',
      loadingId: loading._id
    });
  } catch (err) {
    next(err);
  }
});



module.exports = router;
