// controllers/driverController.js
const express = require('express');
const router  = express.Router();
const Driver  = require('../models/Driver');

// GET /api/drivers
// List all drivers, with depot and profile (employee) populated
router.get('/', async (req, res, next) => {
  try {
    const list = await Driver.find()
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName')
      .lean(); // lean to avoid getters/virtuals throwing
    res.json(list);
  } catch (err) {
    // Surface the real reason in development and still return JSON
    console.error('GET /api/drivers failed:', err?.message || err);
    res.status(500).json({ error: 'Failed to load drivers', detail: err?.message || String(err) });
  }
});

// GET /api/drivers/:id
// Fetch one driver by ID
router.get('/:id', async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName')
      .lean();
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(driver);
  } catch (err) {
    console.error('GET /api/drivers/:id failed:', err?.message || err);
    res.status(500).json({ error: 'Failed to load driver', detail: err?.message || String(err) });
  }
});

// POST /api/drivers
// Create a new driver
router.post('/', async (req, res, next) => {
  try {
    const {
      driverName,
      profile,
      depot,
      pesoLicenseNo,
      licenseNumber
    } = req.body;

    if (!driverName || !depot) {
      return res.status(400).json({
        error: 'driverName and depot are required'
      });
    }

    const newDriver = await Driver.create({
      driverName,
      profile: profile || null,
      depot,
      pesoLicenseNo,
      licenseNumber
    });

    const populated = await Driver.findById(newDriver._id)
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('POST /api/drivers failed:', err?.message || err);
    res.status(500).json({ error: 'Failed to create driver', detail: err?.message || String(err) });
  }
});

// PUT /api/drivers/:id
// Update an existing driver
router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    for (const field of [
      'driverName',
      'profile',
      'depot',
      'pesoLicenseNo',
      'licenseNumber'
      // NOTE: do not allow editing currentTrip/currentTripStatus from here
    ]) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updated = await Driver.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName')
      .lean();

    if (!updated) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/drivers/:id failed:', err?.message || err);
    res.status(500).json({ error: 'Failed to update driver', detail: err?.message || String(err) });
  }
});

// DELETE /api/drivers/:id
// Remove a driver
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Driver.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/drivers/:id failed:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete driver', detail: err?.message || String(err) });
  }
});

module.exports = router;
