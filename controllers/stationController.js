const express = require('express');
const router  = express.Router();
const Station = require('../models/Station');
const requireAuth = require('../middleware/requireAuth');

// 🔐 if you want only authenticated users:
// router.use(requireAuth);

/**
 * GET /api/stations
 * List all stations
 */
router.get('/', async (req, res, next) => {
  try {
    const stations = await Station.find();
    res.json(stations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stations/:id
 * Fetch a single station
 */
router.get('/:id', async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/stations
 * Create a new station
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const station = await Station.create({ name, location });
    res.status(201).json(station);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/stations/:id
 * Update an existing station
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name != null)     updates.name     = req.body.name;
    if (req.body.location != null) updates.location = req.body.location;

    const updated = await Station.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Station not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/stations/:id
 * Remove a station
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Station.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Station not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
