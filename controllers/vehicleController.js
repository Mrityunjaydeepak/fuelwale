// controllers/vehiclesController.js
const express = require('express');
const mongoose = require('mongoose');
const router  = express.Router();

const requireAuth = require('../middleware/requireAuth');
const Driver  = require("../models/Driver");
const Vehicle = require('../models/Vehicle');
const Order   = require('../models/Order');

router.use(requireAuth);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

/* ------------ LIST (with optional ?search=) ------------ */
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query || {};
    const q = search
      ? { vehicleNo: new RegExp(String(search).replace(/\s+/g, ''), 'i') }
      : {};
    const list = await Vehicle.find(q).sort({ vehicleNo: 1 }).lean();
    res.json(list);
  } catch (e) { next(e); }
});

/* --------------------------- CREATE --------------------------- */
router.post('/', async (req, res, next) => {
  try {
    const v = await Vehicle.create(req.body);
    res.status(201).json(v);
  } catch (e) { next(e); }
});

/* ---------------------------- READ ---------------------------- */
router.get('/:id', async (req, res, next) => {
  try {
    const v = await Vehicle.findById(req.params.id).lean();
    if (!v) return res.status(404).json({ error: 'Not found' });
    res.json(v);
  } catch (e) { next(e); }
});

/* --------------------------- UPDATE --------------------------- */
router.put('/:id', async (req, res, next) => {
  try {
    const v = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!v) return res.status(404).json({ error: 'Not found' });
    res.json(v);
  } catch (e) { next(e); }
});

/* --------------------------- DELETE --------------------------- */
router.delete('/:id', async (req, res, next) => {
  try {
    const v = await Vehicle.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

/* ===================== ALLOCATION APIs ===================== */

/**
 * PUT /api/vehicles/:id/allocate
 * body: { orderId }
 * - marks vehicle as allocated (atomic)
 * - writes vehicle details into the Order (expects fields `vehicle`, `vehicleRegNo`, `allocatedAt`, `allocatedBy`)
 * - returns the complete updated Order (populated) so your UI can refresh the row + summary
 */
router.put('/:id/allocate', async (req, res, next) => {
  try {
    const vehicleId = req.params.id;
    const { orderId } = req.body || {};

    if (!isId(vehicleId)) return res.status(400).json({ error: 'Invalid vehicle id' });
    if (!isId(orderId))   return res.status(400).json({ error: 'Valid orderId is required' });

    const order = await Order.findById(orderId)
      .populate('customer', 'custCd custName depotCd')
      .lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // allocate vehicle atomically
    const vehicle = await Vehicle.allocateToOrder(vehicleId, orderId, req.user?.empCd || req.user?.id);

    // mirror to Order (these fields should exist on your Order schema)
    const orderUpdate = await Order.findByIdAndUpdate(orderId, {
      $set: {
        vehicle: vehicle._id,
        vehicleRegNo: vehicle.vehicleNo,
        allocatedAt: vehicle.allocatedAt,
        allocatedBy: vehicle.allocatedBy
      }
    }, { new: true })
      .populate('customer', 'custCd custName depotCd')
      .populate('vehicle', 'vehicleNo calibratedCapacity depotCd');

    res.json({
      order: orderUpdate,    // complete updated order for your “Order Summary”
      vehicle                // updated vehicle doc (now allocated)
    });
  } catch (e) {
    if (String(e.message || '').includes('already allocated')) {
      return res.status(409).json({ error: 'Vehicle already allocated' });
    }
    next(e);
  }
});
// PUT /vehicles/:id/assign-driver
router.put("/:id/assign-driver", async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { driverId, orderId } = req.body;

    // 1) Validate & load docs
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // 2) Assign driver to vehicle
    vehicle.driver = driver._id;
    await vehicle.save();

    // 3) (Optional but your UI expects it) mirror onto the order
    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      order.driver = driver._id;
      // also mirror vehicle if you want consistency
      if (!order.vehicle) order.vehicle = vehicle._id;
      await order.save();
      // If you populate on the client, you can populate here too:
      order = await Order.findById(orderId)
        .populate("vehicle")
        .populate("driver");
    }

    // 4) Respond with the updated order (what your UI consumes)
    return res.json({ order: order || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to assign driver" });
  }
});
/**
 * PUT /api/vehicles/:id/release
 * body: { orderId? }  // optional; if omitted, release whatever order the vehicle is holding
 * - clears allocation on vehicle
 * - clears allocation fields on the order
 * - returns the updated order (if any) + vehicle
 */
router.put('/:id/release', async (req, res, next) => {
  try {
    const vehicleId = req.params.id;
    const { orderId } = req.body || {};
    if (!isId(vehicleId)) return res.status(400).json({ error: 'Invalid vehicle id' });

    const vehicleDoc = await Vehicle.findById(vehicleId);
    if (!vehicleDoc) return res.status(404).json({ error: 'Vehicle not found' });

    const linkedOrderId = isId(orderId) ? orderId : (vehicleDoc.allocatedTo ? String(vehicleDoc.allocatedTo) : null);

    // release vehicle first
    const releasedVehicle = await Vehicle.findByIdAndUpdate(vehicleId, {
      $set: { isAllocated: false },
      $unset: { allocatedTo: 1, allocatedAt: 1, allocatedBy: 1 }
    }, { new: true });

    let clearedOrder = null;
    if (linkedOrderId) {
      clearedOrder = await Order.findByIdAndUpdate(linkedOrderId, {
        $unset: { vehicle: 1, vehicleRegNo: 1, allocatedAt: 1, allocatedBy: 1 }
      }, { new: true })
        .populate('customer', 'custCd custName depotCd');
    }

    res.json({
      order: clearedOrder,   // may be null if no order was linked
      vehicle: releasedVehicle
    });
  } catch (e) { next(e); }
});

module.exports = router;
