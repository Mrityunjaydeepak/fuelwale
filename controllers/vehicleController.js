// controllers/vehicleController.js

const express = require('express');
const router  = express.Router();
const Vehicle = require('../models/Vehicle');
// const requireAuth = require('../middleware/requireAuth');

// 🔐 If you want to require authentication, uncomment:
// router.use(requireAuth);

/**
 * GET /api/vehicles
 * List all vehicles (with route populated)
 */
router.get('/', async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find().populate('route');
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vehicles/:id
 * Fetch one vehicle by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate('route');
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vehicles
 * Create a new vehicle
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      vehicleNo,
      depotCd,
      brand,
      model,
      calibratedCapacity,
      dipStickYesNo,
      gpsYesNo,
      loadSensorYesNo,
      route
    } = req.body;

    if (!vehicleNo || !depotCd) {
      return res.status(400).json({
        error: 'vehicleNo and depotCd are required'
      });
    }

    const vehicle = await Vehicle.create({
      vehicleNo,
      depotCd,
      brand,
      model,
      calibratedCapacity,
      dipStickYesNo,
      gpsYesNo,
      loadSensorYesNo,
      route
    });

    res.status(201).json(vehicle);
  } catch (err) {
    // handle duplicate-key (unique) errors on vehicleNo, etc.
    next(err);
  }
});

/**
 * PUT /api/vehicles/:id
 * Update an existing vehicle
 */
router.put('/:id', async (req, res, next) => {
  try {
    const {
      vehicleNo,
      depotCd,
      brand,
      model,
      calibratedCapacity,
      dipStickYesNo,
      gpsYesNo,
      loadSensorYesNo,
      route
    } = req.body;

    const updates = {};
    if (vehicleNo   != null) updates.vehicleNo          = vehicleNo;
    if (depotCd     != null) updates.depotCd            = depotCd;
    if (brand       != null) updates.brand              = brand;
    if (model       != null) updates.model              = model;
    if (calibratedCapacity != null) updates.calibratedCapacity = calibratedCapacity;
    if (dipStickYesNo      != null) updates.dipStickYesNo      = dipStickYesNo;
    if (gpsYesNo           != null) updates.gpsYesNo           = gpsYesNo;
    if (loadSensorYesNo    != null) updates.loadSensorYesNo    = loadSensorYesNo;
    if (route       != null) updates.route              = route;

    const updated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('route');

    if (!updated) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/vehicles/:id
 * Remove a vehicle
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Vehicle.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
