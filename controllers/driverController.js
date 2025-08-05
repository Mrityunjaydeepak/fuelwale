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
      .populate('profile', 'empCd empName');
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/:id
// Fetch one driver by ID
router.get('/:id', async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName');
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(driver);
  } catch (err) {
    next(err);
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
      profile,
      depot,
      pesoLicenseNo,
      licenseNumber
    });

    // populate before returning
    const populated = await Driver.findById(newDriver._id)
      .populate('depot', 'depotCd depotName')
      .populate('profile', 'empCd empName');

    res.status(201).json(populated);
  } catch (err) {
    next(err);
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
      .populate('profile', 'empCd empName');

    if (!updated) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/drivers/:id
// Remove a driver
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Driver.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
