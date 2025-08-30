// controllers/paymentController.js
const express     = require('express');
const mongoose    = require('mongoose');
const router      = express.Router();

const Payment     = require('../models/Payment');
const requireAuth = require('../middleware/requireAuth');

const { Types } = mongoose;
const isObjId = (v) => !!v && Types.ObjectId.isValid(String(v));

// protect all routes
router.use(requireAuth);

/**
 * GET /api/payments
 * Query params:
 *  - q: search (transName, custCd, custName, refNo, remarks)
 *  - status: DRAFT|SUBMITTED|ALL (default hides DELETED)
 *  - transType: RECEIPT|PAYMENT|ADJUSTMENT|ALL
 *  - mode: CASH|UPI|NEFT|RTGS|CHEQUE|CARD|OTHER|ALL
 *  - from, to: ISO dates (filter by txDate; 'to' inclusive)
 *  - page (1+), limit (1..200)
 *  - includeDeleted=false|true
 * Returns: { data, page, pages, total, totals: { amount } }
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      q = '',
      status,
      transType,
      mode,
      from,
      to,
      page = '1',
      limit = '50',
      includeDeleted = 'false'
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const filter = {};

    // hide DELETED by default
    if (includeDeleted !== 'true') filter.status = { $ne: 'DELETED' };

    if (status && status !== 'ALL') filter.status = status;
    if (transType && transType !== 'ALL') filter.transType = transType;
    if (mode && mode !== 'ALL') filter.mode = mode;

    if (from || to) {
      filter.txDate = {};
      if (from) filter.txDate.$gte = new Date(from);
      if (to) {
        const t = new Date(to);
        t.setHours(23, 59, 59, 999);
        filter.txDate.$lte = t;
      }
    }

    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { transName: rx },
        { custCd: rx },
        { custName: rx },
        { refNo: rx },
        { remarks: rx }
      ];
    }

    const query = Payment.find(filter).sort({ txDate: -1, createdAt: -1 });

    const [data, total, agg] = await Promise.all([
      query.skip((p - 1) * l).limit(l).lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: null, amount: { $sum: '$amount' } } }
      ])
    ]);

    const pages = Math.ceil(total / l) || 1;
    const totals = { amount: agg?.[0]?.amount || 0 };

    res.json({ data, page: p, pages, total, totals });
  } catch (err) { next(err); }
});

/**
 * GET /api/payments/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Payment.findById(id);
    if (!doc || doc.status === 'DELETED') return res.status(404).json({ error: 'Not found' });

    res.json(doc);
  } catch (err) { next(err); }
});

/**
 * POST /api/payments
 * Body: { transType, transName?, custCd?, custName?, customerId?,
 *         amount, mode, refNo?, remarks?, txDate?, orderId?, tripId? }
 * Creates in DRAFT status by default.
 * Sanitizes orderId/tripId: only sets them if valid ObjectIds.
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      transType, transName,
      custCd, custName, customerId,
      amount, mode, refNo, remarks,
      txDate, orderId, tripId
    } = req.body;

    if (!transType || amount == null || !mode) {
      return res.status(400).json({ error: 'transType, amount and mode are required' });
    }
    if (!(Number.isFinite(Number(amount)) && Number(amount) >= 0)) {
      return res.status(400).json({ error: 'amount must be a number >= 0' });
    }

    const payload = {
      transType,
      transName,
      custCd, custName, customerId,
      amount: Number(amount),
      mode,
      refNo, remarks,
      txDate: txDate ? new Date(txDate) : new Date(),
      status: 'DRAFT',
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    };

    // sanitize optional refs
    if (isObjId(orderId)) payload.orderId = orderId;
    if (isObjId(tripId))  payload.tripId  = tripId;

    const doc = await Payment.create(payload);
    res.status(201).json({ message: 'Payment created', id: doc._id });
  } catch (err) { next(err); }
});

/**
 * PUT /api/payments/:id
 * Allowed only if status === DRAFT (Modify)
 * Sanitizes orderId/tripId: set only if valid; clear if invalid/empty.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Payment.findById(id);
    if (!doc || doc.status === 'DELETED') return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'DRAFT') return res.status(409).json({ error: 'Only DRAFT payments can be modified' });

    const allowed = ['transType','transName','custCd','custName','customerId','amount','mode','refNo','remarks','txDate','orderId','tripId'];
    for (const k of allowed) {
      if (!(k in req.body)) continue;

      if (k === 'orderId') {
        if (isObjId(req.body.orderId)) doc.orderId = req.body.orderId; else doc.orderId = undefined;
        continue;
      }
      if (k === 'tripId') {
        if (isObjId(req.body.tripId)) doc.tripId = req.body.tripId; else doc.tripId = undefined;
        continue;
      }

      doc[k] = req.body[k];
    }

    if (doc.amount != null) {
      const num = Number(doc.amount);
      if (!(Number.isFinite(num) && num >= 0)) return res.status(400).json({ error: 'amount must be >= 0' });
      doc.amount = num;
    }

    if (doc.txDate) doc.txDate = new Date(doc.txDate);

    doc.updatedBy = req.user?._id;
    await doc.save();
    res.json({ message: 'Payment updated' });
  } catch (err) { next(err); }
});

/**
 * POST /api/payments/:id/submit
 * Moves DRAFT → SUBMITTED and stamps submittedAt (Submit)
 */
router.post('/:id/submit', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Payment.findById(id);
    if (!doc || doc.status === 'DELETED') return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'DRAFT') return res.status(409).json({ error: 'Only DRAFT payments can be submitted' });

    doc.status = 'SUBMITTED';
    doc.submittedAt = new Date();
    doc.updatedBy = req.user?._id;
    await doc.save();

    res.json({ message: 'Payment submitted' });
  } catch (err) { next(err); }
});

/**
 * POST /api/payments/:id/reset
 * Resets editable fields back to blank/zero while staying in DRAFT (Reset)
 */
router.post('/:id/reset', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Payment.findById(id);
    if (!doc || doc.status === 'DELETED') return res.status(404).json({ error: 'Not found' });
    if (doc.status !== 'DRAFT') return res.status(409).json({ error: 'Only DRAFT payments can be reset' });

    // keep transType & txDate; clear others
    doc.transName  = '';
    doc.custCd     = '';
    doc.custName   = '';
    doc.customerId = undefined;
    doc.amount     = 0;
    doc.mode       = 'CASH';
    doc.refNo      = '';
    doc.remarks    = '';
    doc.orderId    = undefined;
    doc.tripId     = undefined;

    doc.updatedBy  = req.user?._id;
    await doc.save();

    res.json({ message: 'Payment reset' });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/payments/:id
 * Soft delete (status → DELETED)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Payment.findById(id);
    if (!doc || doc.status === 'DELETED') return res.status(404).json({ error: 'Not found' });

    doc.status = 'DELETED';
    doc.deletedAt = new Date();
    doc.updatedBy = req.user?._id;
    await doc.save();

    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
