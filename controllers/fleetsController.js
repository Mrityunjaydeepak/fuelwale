// controllers/fleetController.js
const mongoose = require('mongoose');
const Fleet = require('../models/Fleet');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Order = require('../models/Order');

// Orders in these statuses are treated as not actively using a fleet.
const INACTIVE_ORDER_STATUSES = ['COMPLETED', 'CANCELLED'];

/* ------------------------- helpers ------------------------- */

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

/* ------------------------- list fleets ------------------------- */
/**
 * GET /fleets
 * ?q=...&depotCd=...&gps=yes|no
 * Responds with fleets (vehicle+driver populated) and an `isAllocated` flag
 * indicating whether any active order references that fleet.
 */
exports.list = async (req, res) => {
  try {
    const { q = '', depotCd = '', gps = '' } = req.query;
    const where = {};
    if (depotCd) where.depotCd = depotCd.toUpperCase();
    if (gps === 'yes') where.gpsYesNo = true;
    if (gps === 'no') where.gpsYesNo = false;

    let fleets = await Fleet.find(where)
      .populate('vehicle')
      .populate('driver')
      .lean();

    // client-side like search
    if (q && q.trim()) {
      const s = q.trim().toLowerCase();
      fleets = fleets.filter((f) => {
        const v = f.vehicle || {};
        const d = f.driver || {};
        return [
          v.vehicleNo,
          v.make,
          v.model,
          v.depotCd,
          v.pesoNo,
          d.driverName,
          d.profile?.empName,
        ]
          .map((x) => String(x || '').toLowerCase())
          .some((t) => t.includes(s));
      });
    }

    // Aggregate active orders to mark fleets in use
    const usage = await Order.aggregate([
      {
        $match: {
          fleet: { $ne: null },
          orderStatus: { $nin: INACTIVE_ORDER_STATUSES },
        },
      },
      { $group: { _id: '$fleet', cnt: { $sum: 1 } } },
    ]);
    const used = new Map(usage.map((u) => [String(u._id), u.cnt]));
    fleets = fleets.map((f) => ({
      ...f,
      isAllocated: !!used.get(String(f._id)),
    }));

    res.json(fleets);
  } catch (e) {
    console.error('fleets.list error', e);
    res.status(500).json({ error: 'Failed to get fleets' });
  }
};

/* ------------------ driver pairing maintenance ------------------ */
/**
 * PUT /fleets/assign-driver
 * body: { vehicleId, driverId, assignedBy }
 */
exports.assignDriver = async (req, res) => {
  try {
    const { vehicleId, driverId, assignedBy } = req.body || {};
    if (!isValidId(vehicleId))
      return res.status(400).json({ error: 'Invalid vehicleId' });
    if (!isValidId(driverId))
      return res.status(400).json({ error: 'Invalid driverId' });

    const [v, d] = await Promise.all([
      Vehicle.findById(vehicleId),
      Driver.findById(driverId),
    ]);
    if (!v) return res.status(404).json({ error: 'Vehicle not found' });
    if (!d) return res.status(404).json({ error: 'Driver not found' });

    const fleet = await Fleet.findOneAndUpdate(
      { vehicle: v._id },
      {
        $set: {
          vehicle: v._id,
          driver: d._id,
          depotCd: v.depotCd || undefined,
          gpsYesNo: !!v.gpsYesNo,
          assignedAt: new Date(),
          assignedBy: assignedBy || 'system',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate('vehicle')
      .populate('driver');

    res.json({ fleet });
  } catch (e) {
    console.error('fleets.assignDriver error', e);
    res.status(500).json({ error: e.message || 'Failed to assign driver' });
  }
};

/**
 * PUT /fleets/release-driver
 * body: { vehicleId }
 */
exports.releaseDriver = async (req, res) => {
  try {
    const { vehicleId } = req.body || {};
    if (!isValidId(vehicleId))
      return res.status(400).json({ error: 'Invalid vehicleId' });

    const fleet = await Fleet.findOneAndUpdate(
      { vehicle: vehicleId },
      { $unset: { driver: 1, assignedAt: 1, assignedBy: 1 } },
      { new: true }
    )
      .populate('vehicle')
      .populate('driver');

    if (!fleet) return res.status(404).json({ error: 'Fleet entry not found' });
    res.json({ fleet });
  } catch (e) {
    console.error('fleets.releaseDriver error', e);
    res.status(500).json({ error: e.message || 'Failed to remove driver' });
  }
};

/* ----------------- allocate / release to order ----------------- */
/**
 * PUT /fleets/:id/allocate
 * body: { orderId }
 * Links the fleet to the order and mirrors vehicle/driver to order fields.
 */
exports.allocateToOrder = async (req, res) => {
  try {
    const fleetId = req.params.id;
    const { orderId } = req.body || {};
    if (!isValidId(fleetId)) return res.status(400).json({ error: 'Invalid fleet id' });
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Invalid orderId' });

    const fleet = await Fleet.findById(fleetId)
      .populate('vehicle')
      .populate('driver');
    if (!fleet) return res.status(404).json({ error: 'Fleet not found' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Link fleet
    order.fleet = fleet._id;

    // Optional mirrors for convenience in UI/exports
    order.vehicle = fleet.vehicle?._id || null;
    order.vehicleRegNo = fleet.vehicle?.vehicleNo || '';
    order.driver = fleet.driver?._id || null;
    order.allocatedAt = new Date();

    await order.save();

    const updated = await Order.findById(order._id)
      .populate({ path: 'fleet', populate: [{ path: 'vehicle' }, { path: 'driver' }] })
      .populate('vehicle')
      .populate('driver')
      .lean();

    res.json({ order: updated });
  } catch (e) {
    console.error('fleets.allocateToOrder error', e);
    res.status(500).json({ error: e.message || 'Failed to allocate fleet to order' });
  }
};

/**
 * PUT /fleets/:id/release
 * body: { orderId }
 * Unlinks the fleet from the order and clears the mirrors.
 */
exports.releaseFromOrder = async (req, res) => {
  try {
    const fleetId = req.params.id;
    const { orderId } = req.body || {};
    if (!isValidId(fleetId)) return res.status(400).json({ error: 'Invalid fleet id' });
    if (!isValidId(orderId)) return res.status(400).json({ error: 'Invalid orderId' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.fleet && String(order.fleet) !== String(fleetId)) {
      return res.status(409).json({ error: 'This order is not allocated to the specified fleet' });
    }

    order.fleet = null;
    order.vehicle = null;
    order.vehicleRegNo = '';
    order.driver = null;

    await order.save();

    const updated = await Order.findById(order._id)
      .populate({ path: 'fleet', populate: [{ path: 'vehicle' }, { path: 'driver' }] })
      .populate('vehicle')
      .populate('driver')
      .lean();

    res.json({ order: updated });
  } catch (e) {
    console.error('fleets.releaseFromOrder error', e);
    res.status(500).json({ error: e.message || 'Failed to release fleet from order' });
  }
};

/* --------------------- sync helper endpoint --------------------- */
/**
 * POST /fleets/sync-from-vehicles
 * Ensures every Vehicle has a Fleet shell row.
 */
exports.syncFromVehicles = async (_req, res) => {
  try {
    const vehicles = await Vehicle.find({}, '_id depotCd gpsYesNo').lean();
    const ops = vehicles.map((v) => ({
      updateOne: {
        filter: { vehicle: v._id },
        update: {
          $setOnInsert: {
            vehicle: v._id,
            depotCd: v.depotCd,
            gpsYesNo: !!v.gpsYesNo,
          },
        },
        upsert: true,
      },
    }));
    if (ops.length) await Fleet.bulkWrite(ops);
    res.json({ ok: true, count: ops.length });
  } catch (e) {
    console.error('fleets.sync error', e);
    res.status(500).json({ error: 'Failed to sync fleets' });
  }
};
