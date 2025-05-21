// controllers/salesAssociateController.js
const express = require('express');
const router  = express.Router();
const SalesAssociate = require('../models/SalesAssociate');
const requireAdmin   = require('../middleware/requireAdmin');

// GET all
router.get('/', async (req, res, next) => {
  try {
    const list = await SalesAssociate.find();
    res.json(list);
  } catch (err) { next(err); }
});

// GET by ID
router.get('/:id', async (req, res, next) => {
  try {
    const sa = await SalesAssociate.findById(req.params.id);
    if (!sa) return res.status(404).json({ error: 'Not found' });
    res.json(sa);
  } catch (err) { next(err); }
});
//post
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    // req.body must include: { name, depot, pwd }
    const newSA = await SalesAssociate.create(req.body);
    res.status(201).json(newSA);
  } catch (err) {
    console.error('🛑 Create SA Error:', err);
    if (err.name === 'ValidationError') {
      const details = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: 'Validation failed', details });
    }
    next(err);
  }
});

// PUT /api/sales-associates/:id
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await SalesAssociate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/sales-associates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await SalesAssociate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
