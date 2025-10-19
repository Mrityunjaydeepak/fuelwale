// controllers/payRecController.js
const express = require('express');
const router = express.Router();

const PayRec = require('../models/PayRec');
const requireAuth = require('../middleware/requireAuth');
const User = require('../models/User');

const USER_TYPES = (User && User.USER_TYPES) ? User.USER_TYPES : { ADMIN: 'A', ACCOUNTS: 'AC' };
function canUseAccounts(req) {
  const t = req.user?.userType;
  return t === USER_TYPES.ADMIN || t === USER_TYPES.ACCOUNTS;
}

router.use(requireAuth);

// CREATE
router.post('/', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });

    const payload = {
      date:         req.body.date,
      trType:       req.body.trType,
      partyCode:    req.body.partyCode,
      partyName:    req.body.partyName,
      forPartyCode: req.body.forPartyCode,
      forPartyName: req.body.forPartyName,
      mode:         req.body.mode,
      refNo:        req.body.refNo,
      amount:       req.body.amount,
      remarks:      req.body.remarks,
      mgr:          req.body.mgr,              // <<— accept Mgr
      status:       req.body.status,
      createdBy:    req.user?.id,
      updatedBy:    req.user?.id
    };

    const doc = await PayRec.create(payload);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// LIST
router.get('/', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });

    const { from, to, trType, mode, partyCode, forPartyCode, status, q } = req.query;
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }
    if (trType) filter.trType = trType;
    if (mode) filter.mode = mode;
    if (partyCode) filter.partyCode = partyCode;
    if (forPartyCode) filter.forPartyCode = forPartyCode;
    if (status) filter.status = status; else filter.status = { $ne: PayRec.STATUSES.DELETED };

    if (q) {
      filter.$or = [
        { partyCode: { $regex: q, $options: 'i' } },
        { partyName: { $regex: q, $options: 'i' } },
        { forPartyCode: { $regex: q, $options: 'i' } },
        { forPartyName: { $regex: q, $options: 'i' } },
        { refNo: { $regex: q, $options: 'i' } },
        { remarks: { $regex: q, $options: 'i' } },
        { mgr: { $regex: q, $options: 'i' } }          // <<— searchable
      ];
    }

    const [items, total] = await Promise.all([
      PayRec.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
      PayRec.countDocuments(filter)
    ]);

    res.json({ page, limit, total, items });
  } catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });
    const doc = await PayRec.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

// UPDATE
router.put('/:id', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });

    const current = await PayRec.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (current.status === PayRec.STATUSES.DELETED) {
      return res.status(409).json({ error: 'Record is soft-deleted and cannot be modified' });
    }

    Object.assign(current, {
      date:         req.body.date,
      trType:       req.body.trType,
      partyCode:    req.body.partyCode,
      partyName:    req.body.partyName,
      forPartyCode: req.body.forPartyCode,
      forPartyName: req.body.forPartyName,
      mode:         req.body.mode,
      refNo:        req.body.refNo,
      amount:       req.body.amount,
      remarks:      req.body.remarks,
      mgr:          req.body.mgr,          // <<— update Mgr
      status:       req.body.status,
      updatedBy:    req.user?.id
    });

    const saved = await current.save();
    res.json(saved);
  } catch (err) { next(err); }
});

// STATUS
router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });

    const current = await PayRec.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (current.status === PayRec.STATUSES.DELETED) {
      return res.status(409).json({ error: 'Record is soft-deleted and cannot be modified' });
    }

    current.status = status;
    current.updatedBy = req.user?.id || current.updatedBy || null;
    const saved = await current.save();
    res.json(saved);
  } catch (err) { next(err); }
});

// RESTORE
router.patch('/:id/restore', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });
    const doc = await PayRec.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.status !== PayRec.STATUSES.DELETED) {
      return res.status(409).json({ error: 'Record is not soft-deleted' });
    }
    await doc.restore(req.user?.id);
    res.json({ restored: true, id: String(doc._id) });
  } catch (err) { next(err); }
});

// SOFT DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    if (!canUseAccounts(req)) return res.status(403).json({ error: 'Accounts or Admin required' });

    const doc = await PayRec.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (doc.status === PayRec.STATUSES.DELETED) {
      return res.json({ deleted: true, soft: true, id: String(doc._id) });
    }
    await doc.softDelete(req.user?.id);
    res.json({ deleted: true, soft: true, id: String(doc._id) });
  } catch (err) { next(err); }
});

module.exports = router;
