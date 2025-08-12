// controllers/loadingController.js
const express         = require('express');
const mongoose        = require('mongoose');
const router          = express.Router();

const LoadingMaster   = require('../models/LoadingMaster');
const LoadingAuth     = require('../models/LoadingAuth');
const Loading         = require('../models/Loading');
const BowserInventory = require('../models/BowserInventory');
const Trip            = require('../models/Trip');
const Vehicle         = require('../models/Vehicle');

// NEW: used when listing names safely (no populate cast errors)
const Route           = require('../models/Route');
const Station         = require('../models/Station');
// NEW: the “master” we added that stores routeIds: []
const LoadingSource   = require('../models/LoadingSource');

const requireAuth     = require('../middleware/requireAuth');

router.use(requireAuth);

/* ──────────────────────────── helpers ──────────────────────────── */
function normalizeId(idLike) {
  if (!idLike) return null;
  if (typeof idLike === 'string') return idLike;
  if (typeof idLike === 'object') return idLike._id || idLike.id || idLike.value || null;
  return null;
}
function isValidObjectId(idLike) {
  const s = normalizeId(idLike);
  return !!s && mongoose.Types.ObjectId.isValid(s);
}

/* ───────────────────── route ⇄ station mapping (admin) ───────────────────── */

/**
 * GET /api/loadings/stations
 * Admin list of all mappings. Avoid populate; look up names only for valid IDs.
 */
router.get('/stations', async (req, res, next) => {
  try {
    const masters = await LoadingMaster.find().lean();

    // collect valid ids only
    const routeIds   = new Set();
    const stationIds = new Set();
    for (const m of masters) {
      const r = normalizeId(m.routeId);
      const s = normalizeId(m.stationId);
      if (isValidObjectId(r)) routeIds.add(r);
      if (isValidObjectId(s)) stationIds.add(s);
    }

    // batch lookups
    const [routes, stations] = await Promise.all([
      Route.find({ _id: { $in: [...routeIds] } }).select('name').lean(),
      Station.find({ _id: { $in: [...stationIds] } }).select('name').lean()
    ]);

    const routeNameMap   = Object.fromEntries(routes.map(r => [String(r._id), r.name]));
    const stationNameMap = Object.fromEntries(stations.map(s => [String(s._id), s.name]));

    const rows = masters.map(m => {
      const rId = normalizeId(m.routeId);
      const sId = normalizeId(m.stationId);
      return {
        _id:        String(m._id),
        routeId:    rId,
        routeName:  routeNameMap[String(rId)] || null,
        stationId:  sId,
        stationName:stationNameMap[String(sId)] || null,
        order:      m.order ?? 0,
        createdAt:  m.createdAt,
        updatedAt:  m.updatedAt
      };
    });

    res.json(rows);
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
    let { routeId, stationId, order } = req.body;

    routeId   = normalizeId(routeId);
    stationId = normalizeId(stationId);

    if (!routeId || !stationId) {
      return res.status(400).json({ error: 'routeId and stationId are required' });
    }
    if (!isValidObjectId(routeId) || !isValidObjectId(stationId)) {
      return res.status(400).json({ error: 'Invalid routeId or stationId' });
    }

    const exists = await LoadingMaster.findOne({ routeId, stationId }).lean();
    if (exists) {
      return res.status(400).json({ error: 'This station is already mapped to that route' });
    }

    const master = await LoadingMaster.create({
      routeId,
      stationId,
      order: Number(order) || 0
    });
    res.status(201).json(master);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/loadings/stations/:routeId
 * Returns stations for a given route.
 * Prefers LoadingSource.routeIds (new), falls back to LoadingMaster if none.
 */
router.get('/stations/:routeId', async (req, res, next) => {
  try {
    const raw = req.params.routeId;
    const routeId = normalizeId(raw);
    if (!isValidObjectId(routeId)) {
      return res.status(400).json({ error: 'Invalid routeId' });
    }

    // 1) Try new mapping in LoadingSource
    const mappedSources = await LoadingSource
      .find({ routeIds: routeId })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    if (mappedSources.length) {
      return res.json(mappedSources.map(s => ({ _id: String(s._id), name: s.name })));
    }

    // 2) Fallback to legacy LoadingMaster mapping
    const masters = await LoadingMaster.find({ routeId }).lean().sort({ order: 1 });
    const stationIds = masters
      .map(m => normalizeId(m.stationId))
      .filter(isValidObjectId);

    if (stationIds.length === 0) return res.json([]);

    const stations = await Station.find({ _id: { $in: stationIds } })
      .select('name')
      .sort({ name: 1 })
      .lean();

    const nameMap = Object.fromEntries(stations.map(s => [String(s._id), s.name]));
    const out = stationIds
      .map(id => ({ _id: String(id), name: nameMap[String(id)] || '—' }))
      // de-duplicate while preserving order
      .filter((v, i, a) => a.findIndex(x => x._id === v._id) === i);

    res.json(out);
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
    const id = normalizeId(req.params.id);
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const deleted = await LoadingMaster.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/* ───────────────────── loading auth / code ───────────────────── */

/**
 * POST /api/loadings/generate-code
 */
router.post('/generate-code', async (req, res, next) => {
  try {
    let { tripId } = req.body;
    tripId = normalizeId(tripId);

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({ error: 'Valid tripId required' });
    }
    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Trip not active' });
    }
    const inv = await BowserInventory.findOne({ vehicleNo: trip.vehicleNo });
    if (!inv) return res.status(400).json({ error: 'No inventory for vehicle' });

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
    }
    res.json({ codeRequired, code });
  } catch (err) {
    next(err);
  }
});

// DEV ONLY
router.get('/code/:tripId', async (req, res, next) => {
  try {
    const tripId = normalizeId(req.params.tripId);
    if (!isValidObjectId(tripId)) return res.status(400).json({ error: 'Invalid tripId' });
    const auth = await LoadingAuth.findOne({ tripId });
    if (!auth) return res.status(404).json({ error: 'No code found' });
    res.json({ code: auth.code });
  } catch (err) {
    next(err);
  }
});

/* ───────────────────── record a loading ───────────────────── */

/**
 * POST /api/loadings
 * body: { tripId, code?, stationId, product, qty, vehicleId? }
 */
router.post('/', async (req, res, next) => {
  try {
    let { tripId, code, stationId, product, qty, vehicleId } = req.body;

    tripId    = normalizeId(tripId);
    stationId = normalizeId(stationId);
    vehicleId = normalizeId(vehicleId);

    if (!tripId || !stationId || !product || qty == null) {
      return res.status(400).json({ error: 'tripId, stationId, product, and qty are required' });
    }
    if (!isValidObjectId(tripId) || !isValidObjectId(stationId)) {
      return res.status(400).json({ error: 'Invalid tripId or stationId' });
    }
    if (vehicleId && !isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicleId' });
    }

    // Trip
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // If an auth code exists, it must be provided and valid
    const auth = await LoadingAuth.findOne({ tripId });
    if (auth) {
      if (!code) return res.status(400).json({ error: 'code is required' });
      if (auth.used || auth.expiresAt < new Date() || auth.code !== code) {
        return res.status(403).json({ error: 'Invalid or expired code' });
      }
      auth.used = true;
      await auth.save();
    }

    // Vehicle resolution
    let vehicle = null;
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId);
    }
    if (!vehicle) {
      vehicle = await Vehicle.findOne({ vehicleNo: trip.vehicleNo });
    }
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    // Create loading
    const loading = await Loading.create({
      tripId,
      stationId,
      product,
      qty: Number(qty),
      vehicleNo: vehicle.vehicleNo,
      depotCd:   vehicle.depotCd
    });

    // Deduct inventory
    await BowserInventory.findOneAndUpdate(
      { vehicleNo: trip.vehicleNo },
      { $inc: { balanceLiters: -Number(qty) } },
      { upsert: false }
    );

    res.status(201).json({ message: 'Loading recorded', loadingId: loading._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
