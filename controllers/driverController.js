// controllers/driverController.js
const express = require('express');
const router  = express.Router();
const Driver  = require('../models/Driver');

// GET /api/drivers
router.get('/', async (req, res, next) => {
  try { const list = await Driver.find().populate('depot'); res.json(list); }
  catch (err) { next(err); }
});

// POST /api/drivers
router.post('/', async (req, res, next) => {
  try { const item = await Driver.create(req.body); res.status(201).json(item); }
  catch (err) { next(err); }
});

// PUT /api/drivers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/drivers/:id
router.delete('/:id', async (req, res, next) => {
  try { const d = await Driver.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;