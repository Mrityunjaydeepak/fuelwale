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

/* ------------------------------------------------------------------
   ORDER NUMBER GENERATION
   Format: SS DD ddmmyy RRR
     - SS  : 2 digits State Code
     - DD  : 2 digits Depot Code (from Customer.depotCd)
     - ddmmyy: 6 digits delivery date (day, month, year%100)
     - RRR : running number 001-999 PER (SS+DD+ddmmyy)
   Implementation details:
     - Uses a separate collection "order_counters" to atomically
       increment per-prefix counters to avoid race conditions.
     - You should ensure `orderNo` exists in your Order schema and
       ideally has a unique index for safety.
       e.g. in models/Order.js:
         orderNo: { type: String, unique: true, index: true }
------------------------------------------------------------------- */

// Minimal atomic counter model (local to controller; no external model file needed)
const orderCounterSchema = new mongoose.Schema({
  _id: { type: String },           // prefix: SS+DD+ddmmyy
  seq: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'order_counters' });

const OrderCounter = mongoose.models.OrderCounter || mongoose.model('OrderCounter', orderCounterSchema);

// ---------- helpers ---------- //

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
 * Extract first 2 consecutive digits from a string; pad/truncate to 2.
 * Returns '00' if not found.
 */
function to2DigitCode(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/\d{2}/);
  if (m) return m[0];
  // If it's a single digit like '7'
  const m1 = s.match(/\d/);
  if (m1) return m1[0].padStart(2, '0');
  return '00';
}

/**
 * Format Date -> ddmmyy (6 digits)
 */
function formatDDMMYY(d) {
  const dt = d ? new Date(d) : new Date();
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear() % 100).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

/**
 * Try to figure out which ship-to was used and pick the right State Code.
 * Heuristics:
 * - If shipToAddress contains pieces of shipTo2 address/city/area, pick shipTo2StateCd.
 * - Else fallback to shipTo1StateCd.
 * - If neither gives digits, returns '00'.
 */
function deriveStateCode2Digits(customer, shipToAddress) {
  const hay = String(shipToAddress || '').toLowerCase();

  const s2Hints = [
    customer.shipTo2Add1, customer.shipTo2Add2, customer.shipTo2Add3,
    customer.shipTo2Area, customer.shipTo2City
  ].filter(Boolean).map(x => String(x).toLowerCase());

  const matchedS2 = s2Hints.some(h => h && h.length >= 3 && hay.includes(h));
  const chosen = matchedS2 ? customer.shipTo2StateCd : customer.shipTo1StateCd;

  return to2DigitCode(chosen);
}

/**
 * Atomically get next running number (1..999) for a given prefix.
 * Throws if exceeds 999.
 */
async function getNextRunningNo(prefix) {
  const doc = await OrderCounter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } },
    { new: true, upsert: true }
  ).lean();

  if (!doc || typeof doc.seq !== 'number') throw new Error('Counter not available');
  if (doc.seq > 999) {
    // Optional: you could reset back to 1 and also rotate the prefix/date if desired.
    throw new Error(`Running number exhausted for series ${prefix} ( > 999 )`);
  }
  return doc.seq;
}

/**
 * Build the Order No: SS DD ddmmyy RRR
 * Returns: { orderNo, parts:{ stateCode, depotCode, ddmmyy, run } }
 */
async function generateOrderNo({ customer, shipToAddress, deliveryDate }) {
  const stateCode = deriveStateCode2Digits(customer, shipToAddress);
  const depotCode = to2DigitCode(customer.depotCd);
  const ddmmyy   = formatDDMMYY(deliveryDate);

  const prefix = `${stateCode}${depotCode}${ddmmyy}`;
  const run = await getNextRunningNo(prefix);           // 1..999
  const run3 = String(run).padStart(3, '0');

  return {
    orderNo: `${prefix}${run3}`,
    parts: { stateCode, depotCode, ddmmyy, run }
  };
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
      .select('custCd custName status depotCd ' + // include depotCd so UI could show it if needed
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

    // Fetch customer to access depot/state codes for order number generation
    const customer = await Customer.findById(custId)
      .select('depotCd ' +
              'shipTo1Add1 shipTo1Add2 shipTo1Add3 shipTo1Area shipTo1City shipTo1Pin shipTo1StateCd ' +
              'shipTo2Add1 shipTo2Add2 shipTo2Add3 shipTo2Area shipTo2City shipTo2Pin shipTo2StateCd')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Normalize items
    const normItems = items.map(i => ({
      productName: String(i.productName || 'diesel'),
      quantity:    Number(i.quantity || 0),
      rate:        Number(i.rate || 0)
    }));

    // ---- Generate Order No (concurrency-safe) ----
    const { orderNo, parts } = await generateOrderNo({
      customer,
      shipToAddress: String(shipToAddress || '').trim(),
      deliveryDate:  deliveryDate ? new Date(deliveryDate) : new Date()
    });

    const created = await Order.create({
      customer:         custId,
      orderNo,                           // <<--- NEW
      orderNoMeta: parts,                // optional: remove if your schema is strict
      shipToAddress:    String(shipToAddress || '').trim(),
      orderType:        orderType || 'Regular',
      items:            normItems,
      deliveryDate:     deliveryDate ? new Date(deliveryDate) : null,
      deliveryTimeSlot: String(deliveryTimeSlot || '').trim(),
      orderStatus:      'PENDING',
      confirmedAt:      new Date()
    });

    res.status(201).json(created);
  } catch (err) {
    // If unique index on orderNo exists and a rare duplicate happens, surface a friendly error
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNo) {
      return res.status(409).json({ error: 'Duplicate order number. Please retry.' });
    }
    next(err);
  }
});



// PATCH /orders/:id/status  { orderStatus: 'ASSIGNED' }
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    if (!['PENDING','PARTIALLY_COMPLETED','COMPLETED','CANCELLED','ASSIGNED'].includes(orderStatus)) {
      return res.status(400).json({ error: 'Invalid orderStatus' });
    }
    const doc = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { orderStatus } },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'Order not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

module.exports = router;

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

    // IMPORTANT: We do NOT regenerate orderNo on updates.
    delete payload.orderNo;
    delete payload.orderNoMeta;

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
