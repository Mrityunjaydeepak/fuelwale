const express = require('express');
const router = express.Router();

const Customer = require('../models/Customer');
const customerController = require('../controllers/customerController');

const requireAuth = require('../middleware/requireAuth');
const requireDepotScope = require('../middleware/requireDepotScope');

router.use(requireAuth);

/**
 * GET /api/customers
 * Admin: all customers
 * Non-admin: only customers in req.user.depotCd
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.isAdmin ? {} : { depotCd: req.user.depotCd };
    const list = await Customer.find(filter).lean();
    return res.json(list);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/customers/mapped-sales/:mappedSales
 * Admin: all depots
 * Non-admin: only their depot
 */
router.get('/mapped-sales/:mappedSales', async (req, res, next) => {
  try {
    const { mappedSales } = req.params;

    if (!mappedSales || !mappedSales.trim()) {
      return res.status(400).json({ error: 'mappedSales is required' });
    }

    const query = {
      mappedSales: mappedSales.trim()
    };

    if (!req.user.isAdmin) {
      query.depotCd = req.user.depotCd;
    }

    const customers = await Customer.find(query).lean();

    return res.json(customers);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/customers/depot/:depotCd
 * Admin: any depot
 * Non-admin: only their own depot
 */
router.get(
  '/depot/:depotCd',
  requireDepotScope({
    source: 'params',
    key: 'depotCd',
    adminBypass: true,
    allowMissing: false
  }),
  async (req, res, next) => {
    try {
      const depotCd = String(req.params.depotCd).trim();
      const customers = await Customer.find({ depotCd }).lean();
      return res.json(customers);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/customers/:id
 * Admin: any customer
 * Non-admin: only within req.user.depotCd
 */
router.get('/:id', async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (!req.user.isAdmin) query.depotCd = req.user.depotCd;

    const doc = await Customer.findOne(query).lean();
    if (!doc) return res.status(404).json({ error: 'Customer not found' });

    return res.json(doc);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/customers
 * Admin: can create for any depotCd
 * Non-admin: depotCd forced from token
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};

    const depotCd = req.user.isAdmin
      ? String(body.depotCd || '').trim()
      : String(req.user.depotCd || '').trim();

    if (!depotCd) {
      return res.status(400).json({ error: 'depotCd is required' });
    }

    const created = await Customer.create({
      ...body,
      depotCd
    });

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/customers/:id
 * Admin: can update any customer
 * Non-admin: only within depot; cannot change depotCd
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updates = { ...(req.body || {}) };

    if (!req.user.isAdmin) {
      delete updates.depotCd;
    }

    const query = { _id: req.params.id };
    if (!req.user.isAdmin) query.depotCd = req.user.depotCd;

    const updated = await Customer.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true
    }).lean();

    if (!updated) return res.status(404).json({ error: 'Customer not found' });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/customers/:id
 * Admin: can delete any customer
 * Non-admin: only within depot
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (!req.user.isAdmin) query.depotCd = req.user.depotCd;

    const deleted = await Customer.findOneAndDelete(query).lean();
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });

    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
