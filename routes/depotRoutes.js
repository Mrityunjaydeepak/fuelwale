// routes/depots.js
const express = require('express');
const router = express.Router();

const Depot = require('../models/Depot');
const requireAuth = require('../middleware/requireAuth');
const requireDepotScope = require('../middleware/requireDepotScope');

// All depot routes require authentication
router.use(requireAuth);

/**
 * GET /api/depots
 * Admin: returns all depots
 * Non-admin: returns only the user's depot
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.isAdmin ? {} : { depotCd: req.user.depotCd };
    const list = await Depot.find(filter).lean();
    return res.json(list);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/depots/by-code/:depotCd
 * Admin: can fetch any depot
 * Non-admin: only their depot
 */
router.get(
  '/by-code/:depotCd',
  requireDepotScope({ source: 'params', key: 'depotCd', adminBypass: true, allowMissing: false }),
  async (req, res, next) => {
    try {
      const depot = await Depot.findOne({ depotCd: String(req.params.depotCd).trim() }).lean();
      if (!depot) return res.status(404).json({ error: 'Depot not found' });
      return res.json(depot);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/depots/:id
 * Admin: can fetch any depot
 * Non-admin: only if that depot's depotCd matches req.user.depotCd
 */
router.get('/:id', async (req, res, next) => {
  try {
    const depot = await Depot.findById(req.params.id).lean();
    if (!depot) return res.status(404).json({ error: 'Depot not found' });

    if (!req.user.isAdmin && String(depot.depotCd).trim() !== String(req.user.depotCd).trim()) {
      return res.status(403).json({ error: 'Forbidden: depot mismatch' });
    }

    return res.json(depot);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/depots
 * Admin only
 */
router.post('/', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin required' });

    const newItem = await Depot.create(req.body);
    return res.status(201).json(newItem);
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/depots/:id
 * Admin only
 */
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin required' });

    const updated = await Depot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Depot not found' });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/depots/:id
 * Admin only
 */
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin required' });

    const deleted = await Depot.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Depot not found' });

    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
