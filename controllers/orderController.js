// controllers/orderController.js
const express     = require('express');
const mongoose    = require('mongoose');
const router      = express.Router();

const requireAuth = require('../middleware/requireAuth');
const Order       = require('../models/Order');
const Customer    = require('../models/Customer');
const Invoice     = require('../models/Invoice');

// Optional (payments). If your app doesn't have it, we ignore payments (0).
let PaymentReceived = null;
try { PaymentReceived = require('../models/PaymentReceived'); } catch {}

router.use(requireAuth);

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);
const toId = (v) => (typeof v === 'string' ? v : (v?._id || v?.id || v?.value || null));

/* ------------------------- helpers ------------------------- */

function joinParts(parts) {
  return parts.filter(Boolean).join(', ');
}

function buildShipToList(c) {
  const s1 = joinParts([
    c.shipTo1Add1, c.shipTo1Add2, c.shipTo1Add3,
    c.shipTo1Area, c.shipTo1City,
    c.shipTo1Pin ? String(c.shipTo1Pin) : null,
    c.shipTo1StateCd
  ]);

  const s2 = joinParts([
    c.shipTo2Add1, c.shipTo2Add2, c.shipTo2Add3,
    c.shipTo2Area, c.shipTo2City,
    c.shipTo2Pin ? String(c.shipTo2Pin) : null,
    c.shipTo2StateCd
  ]);

  return [s1, s2].filter(s => (s && s.trim().length > 0));
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Sum invoices - payments per customer.
 * (Extend later for credit/debit notes / discounts / on-account.)
 */
async function computeOutstandingMap(customerIds) {
  const ids = customerIds.filter(isObjectId);
  if (!ids.length) return {};

  const matchIds = ids.map(id => new mongoose.Types.ObjectId(id));

  const invAgg = await Invoice.aggregate([
    { $match: { customer: { $in: matchIds } } },
    { $group: { _id: '$customer', total: { $sum: '$totalAmount' } } }
  ]);
  const invoiceMap = Object.fromEntries(invAgg.map(x => [String(x._id), Number(x.total || 0)]));

  let paymentMap = {};
  if (PaymentReceived) {
    const payAgg = await PaymentReceived.aggregate([
      { $match: { customer: { $in: matchIds } } },
      { $group: { _id: '$customer', total: { $sum: '$amount' } } }
    ]);
    paymentMap = Object.fromEntries(payAgg.map(x => [String(x._id), Number(x.total || 0)]));
  }

  const out = {};
  for (const id of ids) {
    const inv = invoiceMap[id] || 0;
    const pay = paymentMap[id] || 0;
    out[id] = round2(inv - pay);
  }
  return out;
}

/* -------------------- GET /orders/customers -------------------- */
/**
 * Admins => ALL customers
 * Non-admins => customers where empCdMapped === req.user.empCd
 * Returns: {_id, custCd, custName, status, outstanding, shipTo:[...]}
 */
router.get('/customers', async (req, res, next) => {
  try {
    const { isAdmin, userType, accessLevel, empCd } = req.user || {};

    // Fallback admin detection (if middleware wasn't updated):
    const adminFallback =
      String(userType || '').toLowerCase() === 'admin' ||
      String(accessLevel || '').toLowerCase() === 'admin';

    // Also treat users with NO empCd link as "global" (common for admin accounts)
    const allowAll = Boolean(isAdmin || adminFallback || !empCd);

    const query = allowAll ? {} : { empCdMapped: empCd || '__NONE__' };

    const customers = await Customer.find(query)
      .select('custCd custName status ' +
              'shipTo1Add1 shipTo1Add2 shipTo1Add3 shipTo1Area shipTo1City shipTo1Pin shipTo1StateCd ' +
              'shipTo2Add1 shipTo2Add2 shipTo2Add3 shipTo2Area shipTo2City shipTo2Pin shipTo2StateCd')
      .sort({ custName: 1 })
      .lean();

    const ids = customers.map(c => String(c._id));
    const outstandingMap = await computeOutstandingMap(ids);

    const list = customers.map(c => ({
      _id:         String(c._id),
      custCd:      c.custCd,
      custName:    c.custName,
      status:      c.status, // 'Active' | 'Inactive' | 'Suspended'
      outstanding: outstandingMap[String(c._id)] || 0,
      shipTo:      buildShipToList(c)
    }));

    res.json(list);
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Orders CRUD --------------------------- */

// GET /api/orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('customer', 'custCd custName depotCd')
      .lean();
    res.json(orders);
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid order id' });
    const order = await Order.findById(id)
      .populate('customer', 'custCd custName depotCd')
      .lean();
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/orders
router.post('/', async (req, res, next) => {
  try {
    const {
      customerId,
      shipToAddress,
      orderType,
      items,
      deliveryDate,
      deliveryTimeSlot
    } = req.body;

    const custId = toId(customerId);
    if (!custId || !isObjectId(custId)) {
      return res.status(400).json({ error: 'Valid customerId is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const normItems = items.map(i => ({
      productName: String(i.productName || 'diesel'),
      quantity:    Number(i.quantity || 0),
      rate:        Number(i.rate || 0)
    }));

    const created = await Order.create({
      customer:         custId,
      shipToAddress:    String(shipToAddress || '').trim(),
      orderType:        orderType || 'Regular',
      items:            normItems,
      deliveryDate:     deliveryDate ? new Date(deliveryDate) : null,
      deliveryTimeSlot: String(deliveryTimeSlot || '').trim(),
      orderStatus:      'PENDING',
      confirmedAt:      new Date()
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid order id' });

    const payload = { ...req.body };
    if (payload.customerId) {
      const cid = toId(payload.customerId);
      if (!isObjectId(cid)) return res.status(400).json({ error: 'Invalid customerId' });
      payload.customer = cid;
      delete payload.customerId;
    }
    if (payload.items) {
      payload.items = payload.items.map(i => ({
        productName: String(i.productName || 'diesel'),
        quantity:    Number(i.quantity || 0),
        rate:        Number(i.rate || 0)
      }));
    }

    const updated = await Order.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isObjectId(id)) return res.status(400).json({ error: 'Invalid order id' });
    const deleted = await Order.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
