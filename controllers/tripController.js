// controllers/tripController.js

const express        = require('express');
const mongoose       = require('mongoose');
const PDFDocument    = require('pdfkit');
const fs             = require('fs');
const path           = require('path');
const numberToWords  = require('number-to-words');     // npm i number-to-words
const QRCode         = require('qrcode');               // npm i qrcode
const router         = express.Router();

const Trip           = require('../models/Trip');
const Vehicle        = require('../models/Vehicle');
const Order          = require('../models/Order');
const DeliveryPlan   = require('../models/DeliveryPlan');
const Delivery       = require('../models/Delivery');
const Invoice        = require('../models/Invoice');
const Counter        = require('../models/Counter');
const requireAuth    = require('../middleware/requireAuth');

// ─────────────────────────────────────────────────────────────────────────────
// Stub helpers (replace with real implementations)
async function getDieselOpening(vehicleNo) { return 1200; }
async function getTodayDeliveries(driverId) {
  return [
    { customer: 'CUST001', qty: 300 },
    { customer: 'CUST002', qty: 200 }
  ];
}
// ─────────────────────────────────────────────────────────────────────────────

// TripNo helpers
function extractTripPrefix(tn) {
  const s = String(tn || '');
  return s.replace(/(\d+)\s*$/, '');
}
async function getNextTripSerialString() {
  const doc = await Counter.findOneAndUpdate(
    { _id: 'tripSerial' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  const n = doc?.seq ?? 1;
  const width = Math.max(3, String(n).length);
  return String(n).padStart(width, '0');
}
async function finalizeTripNo(clientTripNo) {
  const prefix = extractTripPrefix(clientTripNo);
  const serial = await getNextTripSerialString();
  return `${prefix}${serial}`;
}

/**
 * Backfill helper for legacy trips created before tripNo/orderId were required.
 */
async function backfillTripIfNeeded(trip) {
  let changed = false;

  if (!trip.orderId) {
    const dp = await DeliveryPlan.findOne({ tripId: trip._id }, 'orderId').lean();
    if (dp?.orderId) {
      trip.orderId = dp.orderId;
      changed = true;
    }
  }

  if (!trip.tripNo) {
    const prefix = '000000';
    const serial = await getNextTripSerialString();
    trip.tripNo = `${prefix}${serial}`;
    changed = true;
  }

  if (changed) await trip.save();
  return trip;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a vehicle by vehicleNo (case-insensitive fallback) and
 * normalize depot under vehicle.depot.depotCd.
 */
async function loadVehicleWithDepot(vehicleNo) {
  if (!vehicleNo) return null;

  let veh = await Vehicle.findOne({ vehicleNo }).lean();
  if (!veh) {
    const pat = new RegExp(`^${escapeRegExp(vehicleNo)}$`, 'i');
    veh = await Vehicle.findOne({ vehicleNo: pat }).lean();
  }
  if (!veh) return null;

  const out = { ...veh };
  if (!out.depot && out.depotCd) out.depot = { depotCd: out.depotCd };
  else if (out.depot && !out.depot.depotCd && out.depotCd) out.depot = { ...out.depot, depotCd: out.depotCd };
  return out;
}

// ── PDF helpers ──────────────────────────────────────────────────────────────
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
function inr(n) { return inrFmt.format(Number(n || 0)); }
function exists(p) { try { return p && fs.existsSync(p); } catch { return false; } }

// Styled cell drawing (borders like your template)
function cell(doc, x, y, w, h, text, opts = {}) {
  const {
    align = 'left', bold = false, size = 10, fill = null,
    stroke = '#000', padding = 6
  } = opts;

  if (fill) {
    doc.save().fillColor(fill).rect(x, y, w, h).fill().restore();
  }
  if (stroke) {
    doc.save().lineWidth(0.6).strokeColor(stroke).rect(x, y, w, h).stroke().restore();
  }

  doc.fontSize(size);
  if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
  doc.fillColor('#000');

  if (text != null) {
    doc.text(String(text), x + padding, y + padding, {
      width: w - padding * 2,
      height: h - padding * 2,
      align
    });
  }
}

// Protect all routes
router.use(requireAuth);

/**
 * GET /api/trips
 */
router.get('/', async (req, res, next) => {
  try {
    const trips = await Trip.find();
    for (const t of trips) if (!t.tripNo || !t.orderId) await backfillTripIfNeeded(t);
    res.json(trips.map(t => t.toObject()));
  } catch (err) { next(err); }
});

/**
 * GET /api/trips/assigned/:driverId
 */
router.get('/assigned/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
    const docs = await Trip.find({ driverId, status: 'ASSIGNED' }).sort({ createdAt: 1 });
    for (const t of docs) if (!t.tripNo || !t.orderId) await backfillTripIfNeeded(t);
    res.json(docs.map(d => d.toObject()));
  } catch (err) { next(err); }
});

/**
 * GET /api/trips/active/:driverId
 */
router.get('/active/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
    const trip = await Trip.findOne({ driverId, status: 'ACTIVE' });
    if (!trip) return res.status(404).json({ error: 'No active trip found' });
    if (!trip.tripNo || !trip.orderId) await backfillTripIfNeeded(trip);
    res.json(trip.toObject());
  } catch (err) { next(err); }
});

/**
 * GET /api/trips/:id
 * — returns trip + vehicle + driverName + routeName
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const trip = await Trip.findById(id)
      .populate('driverId', 'name driverName')
      .populate('routeId',  'name routeName');

    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.tripNo || !trip.orderId) await backfillTripIfNeeded(trip);

    const out = trip.toObject();
    out.driverName = trip.driverId ? (trip.driverId.name ?? trip.driverId.driverName ?? null) : null;
    out.routeName  = trip.routeId  ? (trip.routeId.name  ?? trip.routeId.routeName  ?? null) : null;
    out.vehicle    = await loadVehicleWithDepot(trip.vehicleNo);

    res.json(out);
  } catch (err) { next(err); }
});

/**
 * POST /api/trips/assign
 */
router.post('/assign', async (req, res, next) => {
  try {
    const { tripNo, driverId, vehicleNo, capacity, routeId, orderId } = req.body;

    if (!tripNo || !driverId || !vehicleNo || capacity == null || !routeId || !orderId) {
      return res.status(400).json({ error: 'tripNo, driverId, vehicleNo, capacity, routeId & orderId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid orderId' });

    const o = await Order.findOne({ _id: orderId, orderStatus: 'PENDING' });
    if (!o) return res.status(400).json({ error: 'Order not found or not pending' });

    const finalTripNo = await finalizeTripNo(tripNo);

    const trip = await Trip.create({
      tripNo: finalTripNo,
      orderId,
      driverId,
      vehicleNo,
      capacity,
      routeId,
      status: 'ASSIGNED',
      assigned: true
    });

    const requiredQty = (o.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    await DeliveryPlan.create({
      tripId:     trip._id,
      orderId:    o._id,
      customerId: o.customer,
      shipTo:     o.shipToAddress,
      requiredQty
    });

    await Delivery.create({
      tripId:     trip._id,
      orderId:    o._id,
      customerId: o.customer,
      shipTo:     o.shipToAddress,
      qty:        0,
      rate:       0,
      dcNo:       null
    });

    res.status(201).json({
      message:               'Trip assigned',
      tripId:                trip._id,
      tripNo:                trip.tripNo,
      seededDeliveriesCount: 1
    });

  } catch (err) { next(err); }
});

/**
 * POST /api/trips/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const {
      tripId, driverId, vehicleNo, startKm, totalizerStart, routeId, remarks
    } = req.body;

    if (!driverId || !vehicleNo || startKm == null || totalizerStart == null || !routeId) {
      return res.status(400).json({
        error: 'driverId, vehicleNo, startKm, totalizerStart and routeId are required'
      });
    }

    let trip = null;
    if (tripId && mongoose.Types.ObjectId.isValid(tripId)) {
      trip = await Trip.findOne({ _id: tripId, status: 'ASSIGNED' });
    }
    if (!trip) trip = await Trip.findOne({ driverId, vehicleNo, status: 'ASSIGNED' });
    if (!trip) return res.status(403).json({ error: 'No assigned trip to start. Please check back later.' });

    if (!trip.tripNo || !trip.orderId) await backfillTripIfNeeded(trip);

    trip.startKm        = startKm;
    trip.totalizerStart = totalizerStart;
    trip.routeId        = routeId;
    trip.remarks        = remarks;
    trip.dieselOpening  = await getDieselOpening(vehicleNo);
    trip.loginTime      = new Date();
    trip.status         = 'ACTIVE';
    await trip.save();

    const deliveries = await getTodayDeliveries(driverId);

    res.json({
      message:       'Trip started successfully',
      tripId:        trip._id,
      dieselOpening: trip.dieselOpening,
      deliveries
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/trips/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { tripId, endKm, totalizerEnd } = req.body;
    if (!tripId || endKm == null || totalizerEnd == null) {
      return res.status(400).json({ error: 'tripId, endKm, and totalizerEnd are required' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'No active trip found to end' });
    }

    if (!trip.tripNo || !trip.orderId) await backfillTripIfNeeded(trip);

    trip.endKm        = endKm;
    trip.totalizerEnd = totalizerEnd;
    trip.logoutTime   = new Date();
    trip.status       = 'COMPLETED';
    await trip.save();

    await Vehicle.findOneAndUpdate(
      { vehicleNo: trip.vehicleNo },
      { lastKm: endKm, lastTotalizer: totalizerEnd }
    );

    const deliveries = await Delivery.find({ tripId })
      .populate('orderId')
      .populate('customerId');

    if (deliveries.length === 0) {
      return res.status(400).json({ error: 'No deliveries made on this trip' });
    }

    const invoices = await Promise.all(deliveries.map(d => {
      const amount = parseFloat((d.qty * d.rate).toFixed(2));
      return Invoice.create({
        order:       d.orderId._id,
        customer:    d.customerId._id,
        items: [{
          productName: d.orderId.items[0]?.productName || 'diesel',
          quantity:    d.qty,
          rate:        d.rate,
          amount
        }],
        totalAmount: amount,
        dcNumber:    `DC${Date.now()}${Math.floor(Math.random()*1000)}`,
        invoiceDate: new Date()
      });
    }));

    res.json({ message: 'Trip closed and orders invoiced', trip, invoices });
  } catch (err) { next(err); }
});

/**
 * GET /api/trips/:id/invoice
 * — Styled like your provided template
 */
router.get('/:id/invoice', async (req, res, next) => {
  try {
    const { id: tripId } = req.params;

    // Load data
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const deliveries = await Delivery.find({ tripId })
      .populate('customerId', 'custName custCd address shipToAddress district rsmName receiverPhone')
      .populate('orderId', 'items referenceNo paymentMethod creditDays')
      .lean();

    if (deliveries.length === 0) {
      return res.status(404).json({ error: 'No deliveries found for this trip' });
    }

    // Company branding (override via env to match your header)
    const COMPANY = {
      titleTop:  'Delivery cum Sales Invoice',
      name:     process.env.COMPANY_NAME    || 'SHREENATH PETROLEUM',
      suffix:   process.env.COMPANY_SUFFIX  || 'PRIVATE LIMITED',
      address:  process.env.COMPANY_ADDRESS || 'Thane, Maharashtra - 421501',
      phone:    process.env.COMPANY_PHONE   || '+91-9321640558',
      email:    process.env.COMPANY_EMAIL   || 'order@fuelwale.com',
      web:      process.env.COMPANY_WEB     || 'www.fuelwale.com'
    };

    const logoLeft   = path.join(process.cwd(), 'assets', 'logo_left.png'); // fuelwale logo
    const imgNozzle  = path.join(process.cwd(), 'assets', 'nozzle.png');
    const imgSign    = path.join(process.cwd(), 'assets', 'sign.png');
    const imgStamp   = path.join(process.cwd(), 'assets', 'stamp.png');

    // Invoice meta
    const todayStr   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const invoiceNo  = `INV${(trip.tripNo || '').replace(/\D/g, '').padStart(6,'0') || Date.now().toString().slice(-9)}`;

    // Customer / order context: take first delivery as the header source
    const first      = deliveries[0];
    const customer   = first.customerId || {};
    const order      = first.orderId || {};

    // Map fields to your template’s labels
    const gridLeft = [
      ['Party Name:',   customer.custName || '—'],
      ['Address:',      (customer.address || first.shipTo || '—')],
      ['PoS:',          customer.address || '—'],
      ['Party Code',    customer.custCd || '—'],
      ['Receiver\'s No.:', customer.receiverPhone || '—'],
      ['Payment:',      order.paymentMethod || 'RTGS'],
      ['DC Number:',    order.referenceNo || `DC${String(trip.tripNo || '').replace(/\D/g,'') || ''}`]
    ];

    const gridRight = [
      ['Invoice No.:',  invoiceNo],
      ['Invoice Date:', todayStr],
      ['District:',     customer.district || '—'],
      ['RSM:',          customer.rsmName || '—'],
      ['Dispenser ID:', trip.vehicleNo || '—'],
      ['Ref. No.:',     order.referenceNo || trip.tripNo || '—'],
      ['Credit Period:', (order.creditDays != null ? `${order.creditDays} Days` : '1 Days')]
    ];

    // Rows for "Description of Goods"
    const rows = deliveries.map((d) => {
      const qty   = Number(d.qty || 0);
      const rate  = Number(d.rate || 0);
      const desc  = (d.orderId?.items?.[0]?.productName) || 'Diesel';
      return {
        desc,
        qty,
        per: 'Liter',
        rate,
        amount: Number((qty * rate).toFixed(2))
      };
    });

    const totalQty   = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const subTotal   = rows.reduce((s, r) => s + (r.amount || 0), 0);

    // Build PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${tripId}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    doc.pipe(res);

    const pageWidth  = doc.page.width;
    const contentW   = pageWidth - 72;          // margin left(36)+right(36)
    const leftX      = 36;

    // Title
    doc.font('Helvetica').fontSize(14).text(COMPANY.titleTop, 0, 18, { align: 'center' });

    // Header box
    const headerY = 36;
    const headerH = 110;
    cell(doc, leftX, headerY, contentW, headerH, null); // outer border

    // Logos
    if (exists(logoLeft))  doc.image(logoLeft, leftX + 8, headerY + 8, { width: 110, height: 90, fit: [110, 90] });
    if (exists(imgNozzle)) doc.image(imgNozzle, leftX + contentW - 120, headerY + 10, { width: 80 });

    // Company name (center-ish)
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#C00000')
       .text(COMPANY.name, leftX, headerY + 12, { width: contentW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
       .text(COMPANY.suffix, leftX, headerY + 34, { width: contentW, align: 'center' });

    doc.font('Helvetica').fontSize(10)
      .text(COMPANY.address, leftX, headerY + 54, { width: contentW, align: 'center' })
      .text(`${COMPANY.phone} | ${COMPANY.email}`, leftX, headerY + 68, { width: contentW, align: 'center' })
      .text(COMPANY.web, leftX, headerY + 82, { width: contentW, align: 'center' });

    // Details grid (like the two-column table in your image)
    let gy = headerY + headerH + 6;
    const rowH = 22;
    const colWLeftKey = 90;
    const colWLeftVal = 220;
    const colWRightKey = 90;
    const colWRightVal = contentW - (colWLeftKey + colWLeftVal + colWRightKey) - 2; // 2 for the gutter lines
    const gridRows = Math.max(gridLeft.length, gridRight.length);

    for (let i = 0; i < gridRows; i++) {
      const y = gy + i * rowH;
      // left pair
      cell(doc, leftX, y, colWLeftKey, rowH, gridLeft[i]?.[0] || '', { bold: true });
      cell(doc, leftX + colWLeftKey, y, colWLeftVal, rowH, gridLeft[i]?.[1] || '');
      // right pair
      const rightStart = leftX + colWLeftKey + colWLeftVal;
      cell(doc, rightStart, y, colWRightKey, rowH, gridRight[i]?.[0] || '', { bold: true });
      cell(doc, rightStart + colWRightKey, y, colWRightVal, rowH, gridRight[i]?.[1] || '');
    }
    const gridBottomY = gy + gridRows * rowH;

    // Items table header
    const itemsHeaderY = gridBottomY + 8;
    const cDesc = 240, cQty = 100, cPer = 80, cRate = 80, cAmt = contentW - (cDesc + cQty + cPer + cRate);
    cell(doc, leftX, itemsHeaderY, contentW, 22, null, { fill: '#e5f1ff' });
    cell(doc, leftX, itemsHeaderY, cDesc, 22, 'Description of Goods', { bold: true });
    cell(doc, leftX + cDesc, itemsHeaderY, cQty, 22, 'Quantity', { bold: true, align: 'right' });
    cell(doc, leftX + cDesc + cQty, itemsHeaderY, cPer, 22, 'Per', { bold: true, align: 'center' });
    cell(doc, leftX + cDesc + cQty + cPer, itemsHeaderY, cRate, 22, 'Unit Rate', { bold: true, align: 'right' });
    cell(doc, leftX + cDesc + cQty + cPer + cRate, itemsHeaderY, cAmt, 22, 'Amount', { bold: true, align: 'right' });

    // Item rows
    let iy = itemsHeaderY + 22;
    rows.forEach(r => {
      cell(doc, leftX, iy, cDesc, 22, r.desc);
      cell(doc, leftX + cDesc, iy, cQty, 22, String(r.qty), { align: 'right' });
      cell(doc, leftX + cDesc + cQty, iy, cPer, 22, r.per, { align: 'center' });
      cell(doc, leftX + cDesc + cQty + cPer, iy, cRate, 22, inr(r.rate), { align: 'right' });
      cell(doc, leftX + cDesc + cQty + cPer + cRate, iy, cAmt, 22, inr(r.amount), { align: 'right' });
      iy += 22;
    });

    // Totals row (bold)
    cell(doc, leftX, iy, cDesc, 22, 'Total Amount', { bold: true });
    cell(doc, leftX + cDesc, iy, cQty, 22, String(totalQty), { bold: true, align: 'right' });
    cell(doc, leftX + cDesc + cQty, iy, cPer, 22, 'Liter', { align: 'center', bold: true });
    cell(doc, leftX + cDesc + cQty + cPer, iy, cRate, 22, '', { });
    cell(doc, leftX + cDesc + cQty + cPer + cRate, iy, cAmt, 22, inr(subTotal), { bold: true, align: 'right' });

    // Receiver / Bank / Authorized block (3 columns)
    const blockY      = iy + 14;
    const blockH      = 140;
    const colA        = 180;  // Receiver's Sign
    const colB        = 240;  // Bank Details + QR
    const colC        = contentW - (colA + colB); // For, Authorized Sign

    // Outer frame
    cell(doc, leftX, blockY, contentW, blockH, null);

    // Column separator lines
    cell(doc, leftX, blockY, colA, blockH, null);
    cell(doc, leftX + colA, blockY, colB, blockH, null);
    cell(doc, leftX + colA + colB, blockY, colC, blockH, null);

    // Left column: Receiver's Sign
    doc.font('Helvetica-Bold').fontSize(11).text("Receiver's Sign.", leftX + 8, blockY + 8);
    if (exists(imgSign)) {
      doc.image(imgSign, leftX + 20, blockY + 32, { width: 110, height: 60, fit: [110, 60] });
    }

    // Middle column: Bank details + QR
    const bankX = leftX + colA + 8;
    const bankY = blockY + 8;
    const bank = {
      bankName: process.env.BANK_NAME || 'Bank of Maharashtra',
      acctName: process.env.BANK_ACCT_NAME || 'Shreenath Petroleum Pvt Ltd',
      acctNo:   process.env.BANK_ACCT_NO || '60528140328',
      ifsc:     process.env.BANK_IFSC || 'MAHB0001006',
      branch:   process.env.BANK_BRANCH || 'BoM & Nariman Point'
    };
    doc.font('Helvetica-Bold').fontSize(10).text('Bank Details:', bankX, bankY);
    doc.font('Helvetica').fontSize(10)
      .text(bank.bankName, bankX, bankY + 16)
      .text(bank.acctName, bankX, bankY + 30)
      .text(`A/c No.: ${bank.acctNo}`, bankX, bankY + 44)
      .text(`IFSC: ${bank.ifsc}`, bankX, bankY + 58)
      .text(`Branch: ${bank.branch}`, bankX, bankY + 72);

    // QR code (upi payment)
    const qrPayload = process.env.UPI_QR_VALUE || ''; // e.g. 'upi://pay?pa=your@upi&pn=Shreenath%20Petroleum&am=0&cu=INR'
    if (qrPayload) {
      try {
        const buf = await QRCode.toBuffer(qrPayload, { width: 110, margin: 0 });
        doc.image(buf, leftX + colA + colB - 120, bankY + 10, { width: 110, height: 110 });
        doc.fontSize(9).text('upi payment', leftX + colA + colB - 120, bankY + 122, { width: 110, align: 'center' });
      } catch {}
    }

    // Right column: For, Company + Authorized Sign
    const rightX = leftX + colA + colB + 8;
    doc.font('Helvetica').fontSize(10).text('For,', rightX, blockY + 8);
    doc.font('Helvetica-Bold').fontSize(11).text(`${COMPANY.name} ${COMPANY.suffix ? 'PVT LTD' : ''}`, rightX + 20, blockY + 8);
    if (exists(imgStamp)) doc.image(imgStamp, rightX + 20, blockY + 28, { width: 110, height: 110, fit: [110, 110], opacity: 0.9 });
    doc.font('Helvetica').fontSize(10).text('Authorized Sign.', rightX + 10, blockY + blockH - 20);

    // Notes bar at bottom
    const notesY = blockY + blockH + 10;
    cell(doc, leftX, notesY, contentW, 36, null);
    doc.font('Helvetica-Bold').fontSize(10).text('Note:-', leftX + 8, notesY + 8);
    const noteTextLeft  = 'Material received by you will be treated as final acceptance. Pay this invoice by due date. 24% PA Interest will be charged on overdue payments.';
    const noteTextRight = 'Subject to Mumbai Jurisdiction';
    doc.font('Helvetica').fontSize(9).text(noteTextLeft, leftX + 50, notesY + 8, { width: contentW - 260 });
    doc.font('Helvetica').fontSize(9).text(noteTextRight, leftX + contentW - 200, notesY + 8, { width: 192, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#C00000').text('Thank You for your business', leftX + 4, notesY + 24);
    doc.fillColor('#000');

    // Amount in words (optional extra, below totals)
    const amountWords = numberToWords.toWords(Math.round(subTotal)).replace(/,/g, '');
    doc.font('Helvetica').fontSize(9)
      .text(`Amount in words: Rupees ${amountWords} only`, leftX, itemsHeaderY - 14);

    doc.end();
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Trip.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
