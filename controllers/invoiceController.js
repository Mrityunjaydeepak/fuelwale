// controllers/invoiceController.js
const express      = require('express');
const mongoose     = require('mongoose');
const router       = express.Router();

const requireAuth  = require('../middleware/requireAuth');
const Trip         = require('../models/Trip');
const Delivery     = require('../models/Delivery');
const Order        = require('../models/Order');
const Customer     = require('../models/Customer'); // adjust name/path if different
const Vehicle      = require('../models/Vehicle');
const Invoice      = require('../models/Invoice');

// protect everything
router.use(requireAuth);

/* ───────────────── helpers ───────────────── */
function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
function computeInvoiceNoFromTrip(tripNo) {
  const d = digitsOnly(tripNo);
  return `INV${(d || '').padStart(6, '0')}`;
}

// small stable stringify to use as group key
function keyOfRow(r) {
  return JSON.stringify({
    productCode: r.productCode || null,
    productName: r.productName || null,
    uom:         r.uom || 'Liter',
    rate:        Number(r.rate || 0)
  });
}

/**
 * Builds a SINGLE-invoice prefill from trip + deliveries.
 * Aggregates deliveries by (productCode, productName, uom, rate).
 */
async function buildPrefillForTrip(tripId) {
  const trip = await Trip.findById(tripId).lean();
  if (!trip) throw Object.assign(new Error('Trip not found'), { status: 404 });

  const deliveries = await Delivery.find({ tripId })
    .populate('orderId', 'items referenceNo paymentMethod creditDays shipToAddress customer')
    .populate('customerId', 'custName custCd address shipToAddress district rsmName receiverPhone')
    .lean();

  if (!deliveries.length) {
    throw Object.assign(new Error('No deliveries for this trip'), { status: 404 });
  }

  // header info from first delivery
  const first     = deliveries[0];
  const order     = first.orderId || {};
  const customer  = first.customerId || {};

  // vehicle snapshot
  const vehicleSnap = {
    vehicleNo: trip?.snapshot?.vehicleNo || null,
    routeId:   trip?.routeId || null
  };

  // aggregate items across all deliveries in this trip
  const map = new Map(); // key → { productCode, productName, uom, rate, quantity, amount }
  for (const d of deliveries) {
    const rowItem = Array.isArray(d.orderId?.items) ? (d.orderId.items[0] || {}) : {};
    const piece = {
      productCode: rowItem.productCode || rowItem.productId || null,
      productName: rowItem.productName || 'Diesel',
      uom:         rowItem.uom || 'Liter',
      rate:        Number(d.rate || 0),
      quantity:    Number(d.qty || 0),
    };
    const amount = Number((piece.quantity * piece.rate).toFixed(2));
    const k = keyOfRow(piece);
    if (!map.has(k)) {
      map.set(k, { ...piece, amount });
    } else {
      const acc = map.get(k);
      acc.quantity += piece.quantity;
      acc.amount = Number((acc.amount + amount).toFixed(2));
    }
  }
  const items = Array.from(map.values());

  const subTotal  = items.reduce((s, it) => s + (it.amount || 0), 0);
  const invoiceNo = computeInvoiceNoFromTrip(trip.tripNo);
  const dcNumber  = order.referenceNo || `DC${digitsOnly(trip.tripNo)}`;

  return {
    tripId,
    invoiceNo,
    invoiceDate: new Date(),

    orderId:    order._id,
    customerId: customer._id,

    customerSnap: {
      custCd: customer.custCd || null,
      custName: customer.custName || null,
      address: customer.address || null,
      shipToAddress: customer.shipToAddress || null,
      district: customer.district || null,
      rsmName: customer.rsmName || null,
      receiverPhone: customer.receiverPhone || null
    },
    orderSnap: {
      referenceNo: order.referenceNo || null,
      paymentMethod: order.paymentMethod || 'RTGS',
      creditDays: order.creditDays ?? 1,
      shipToAddress: order.shipToAddress || null
    },
    vehicleSnap,

    items,
    subTotal,
    totalAmount: subTotal,
    dcNumber,
    notes: 'Subject to Mumbai Jurisdiction'
  };
}

/* ───────────────── routes ───────────────── */

/**
 * GET /api/invoices/prefill-from-trip/:tripId
 * → returns ONE invoice payload for the whole trip (aggregated items)
 */
router.get('/prefill-from-trip/:tripId', async (req, res, next) => {
  try {
    const { tripId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ error: 'Invalid tripId' });
    }
    const prefill = await buildPrefillForTrip(tripId);
    res.json(prefill);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/invoices/from-trip/:tripId
 * → creates ONE invoice per trip using aggregated deliveries
 * Body is optional; if provided, we allow overriding invoiceDate/notes.
 */
router.post('/from-trip/:tripId', async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { tripId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ error: 'Invalid tripId' });
    }

    // Build the single-invoice payload
    const prefill = await buildPrefillForTrip(tripId);

    // allow a couple of overrides from body (e.g., manual invoice date / notes)
    const invoiceDate = req.body?.invoiceDate ? new Date(req.body.invoiceDate) : prefill.invoiceDate;
    const notes       = typeof req.body?.notes === 'string' ? req.body.notes : prefill.notes;

    const created = await Invoice.create([{
      invoiceNo:   prefill.invoiceNo,
      invoiceDate,

      tripId:      prefill.tripId,
      order:       prefill.orderId,
      customer:    prefill.customerId,

      customerSnap: prefill.customerSnap,
      orderSnap:    prefill.orderSnap,
      vehicleSnap:  prefill.vehicleSnap,

      items:       prefill.items.map(it => ({
        productCode: it.productCode || null,
        productName: it.productName || 'Diesel',
        quantity:    Number(it.quantity || 0),
        uom:         it.uom || 'Liter',
        rate:        Number(it.rate || 0),
        amount:      Number(it.amount || 0)
      })),
      subTotal:    Number(prefill.subTotal || 0),
      totalAmount: Number(prefill.totalAmount || 0),
      dcNumber:    prefill.dcNumber,
      notes
    }], { session });

    // (Optional but recommended) Mark related order(s) as COMPLETED if not already
    try {
      if (prefill.orderId) {
        await Order.updateOne(
          { _id: prefill.orderId },
          { $set: { orderStatus: 'COMPLETED', completedAt: new Date() } },
          { session }
        );
      }
    } catch (e) {
      console.warn('Failed to flip order to COMPLETED for trip', String(tripId), e?.message || e);
    }

    await session.commitTransaction(); session.endSession();
    res.status(201).json({ ok: true, invoiceId: created[0]._id });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/invoices/:id  (handy fetch-one for UI)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const doc = await Invoice.findById(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

/**
 * GET /api/invoices
 * Simple list (supports q, from, to)
 */
router.get('/', async (req, res, next) => {
  try {
    const { q = '', from, to, page = '1', limit = '50' } = req.query;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const filter = {};
    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { invoiceNo: rx },
        { dcNumber: rx },
        { 'customerSnap.custCd': rx },
        { 'customerSnap.custName': rx }
      ];
    }
    if (from || to) {
      filter.invoiceDate = {};
      if (from) filter.invoiceDate.$gte = new Date(from);
      if (to) {
        const t = new Date(to);
        t.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = t;
      }
    }

    const [data, total] = await Promise.all([
      Invoice.find(filter).sort({ invoiceDate: -1, createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      Invoice.countDocuments(filter)
    ]);
    const pages = Math.ceil(total / l) || 1;
    res.json({ data, page: p, pages, total });
  } catch (err) { next(err); }
});

module.exports = router;
