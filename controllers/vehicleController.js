// controllers/vehicleController.js

const express = require('express');
const router  = express.Router();
const Vehicle = require('../models/Vehicle');
// const requireAuth = require('../middleware/requireAuth');

// 🔐 If you want to require authentication, uncomment:
// router.use(requireAuth);

/**
 * GET /api/vehicles
 * List all vehicles (with depot populated)
 */
router.get('/', async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find().populate('depot');
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
    const vehicle = await Vehicle.findById(req.params.id).populate('depot');
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
    const { licensePlate, capacityLiters, depot } = req.body;
    if (!licensePlate || capacityLiters == null || !depot) {
      return res.status(400).json({
        error: 'licensePlate, capacityLiters and depot are required'
      });
    }

    const vehicle = await Vehicle.create({
      licensePlate,
      capacityLiters,
      depot
    });
    res.status(201).json(vehicle);
  } catch (err) {
    // handle duplicate-key (unique) errors if licensePlate already exists
    next(err);
  }
});

/**
 * PUT /api/vehicles/:id
 * Update an existing vehicle
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { licensePlate, capacityLiters, depot } = req.body;
    const updates = {};
    if (licensePlate != null)   updates.licensePlate   = licensePlate;
    if (capacityLiters != null) updates.capacityLiters = capacityLiters;
    if (depot != null)          updates.depot          = depot;

    const updated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('depot');

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
