// controllers/tripController.js

const express     = require('express');
const mongoose    = require('mongoose');
const PDFDocument = require('pdfkit');
const router      = express.Router();

const Trip         = require('../models/Trip');
const Vehicle      = require('../models/Vehicle');
const Order        = require('../models/Order');
const DeliveryPlan = require('../models/DeliveryPlan');
const Delivery     = require('../models/Delivery');
const Invoice      = require('../models/Invoice');
const requireAuth  = require('../middleware/requireAuth');

// Stub helpers (replace with real implementations if you have them)
async function getDieselOpening(vehicleNo) { return 1200; }
async function getTodayDeliveries(driverId) {
  return [
    { customer: 'CUST001', qty: 300 },
    { customer: 'CUST002', qty: 200 }
  ];
}

// 🔐 Protect all routes
router.use(requireAuth);

/**
 * GET /api/trips
 */
router.get('/', async (req, res, next) => {
  try {
    const trips = await Trip.find();
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/assigned/:driverId
 */
router.get('/assigned/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driverId' });
    }
    const trips = await Trip.find({ driverId, status: 'ASSIGNED' })
      .sort({ createdAt: 1 });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/active/:driverId
 */
router.get('/active/:driverId', async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({ error: 'Invalid driverId' });
    }
    const trip = await Trip.findOne({ driverId, status: 'ACTIVE' });
    if (!trip) return res.status(404).json({ error: 'No active trip found' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }
    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/assign
 * Assigns a trip, seeds DeliveryPlan AND placeholder Delivery docs
 */
router.post('/assign', async (req, res, next) => {
  try {
    const { driverId, vehicleNo, capacity, routeId, orderId } = req.body;
    // … your existing validation …

    // Create the trip
    const trip = await Trip.create({
      driverId,
      vehicleNo,
      capacity,
      routeId,
      assigned: true,
      status: 'ASSIGNED'
    });

    // Decide which orders to seed: either the single one, or all pending on the route
    let orders = [];
    if (orderId) {
      // Fetch exactly that order, ensure it's still PENDING
      const o = await Order.findOne({
        _id: orderId,
        orderStatus: 'PENDING'
      });
      if (!o) {
        return res.status(400).json({
          error: 'Order not found or not pending'
        });
      }
      orders = [o];
    } else {
      // Fallback: seed every pending on route
      orders = await Order.find({
        routeId,
        orderStatus: 'PENDING'
      });
    }

    if (orders.length) {
      // 1️⃣ Seed DeliveryPlan
      const plans = orders.map(o => ({
        tripId:      trip._id,
        orderId:     o._id,
        customerId:  o.customer,
        shipTo:      o.shipToAddress,
        requiredQty: o.items.reduce((sum,i)=>sum+i.quantity,0)
      }));
      await DeliveryPlan.insertMany(plans);

      // 2️⃣ Create placeholder Delivery docs
      const placeholders = orders.map(o => ({
        tripId:     trip._id,
        orderId:    o._id,
        customerId: o.customer,
        shipTo:     o.shipToAddress,
        qty:        0,
        rate:       0,
        dcNo:       null
      }));
      await Delivery.insertMany(placeholders);
    }

    // return how many you seeded
    res.status(201).json({
      message:                'Trip assigned',
      tripId:                 trip._id,
      seededDeliveriesCount:  orders.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const {
      driverId,
      vehicleNo,
      startKm,
      totalizerStart,
      routeId,
      remarks
    } = req.body;

    if (
      !driverId ||
      !vehicleNo ||
      startKm == null ||
      totalizerStart == null ||
      !routeId
    ) {
      return res.status(400).json({
        error: 'driverId, vehicleNo, startKm, totalizerStart and routeId are required'
      });
    }
    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ error: 'Invalid routeId' });
    }

    const trip = await Trip.findOne({
      driverId,
      vehicleNo,
      status: 'ASSIGNED'
    });
    if (!trip) {
      return res.status(403).json({
        error: 'No assigned trip to start. Please check back later.'
      });
    }

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
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/logout
 * — Ends the trip, updates vehicle, then invoices completed deliveries
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { tripId, endKm, totalizerEnd } = req.body;
    if (!tripId || endKm == null || totalizerEnd == null) {
      return res.status(400).json({
        error: 'tripId, endKm, and totalizerEnd are required'
      });
    }

    // 1) Close out the Trip
    const trip = await Trip.findById(tripId);
    if (!trip || trip.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'No active trip found to end' });
    }
    trip.endKm        = endKm;
    trip.totalizerEnd = totalizerEnd;
    trip.logoutTime   = new Date();
    trip.status       = 'COMPLETED';
    await trip.save();

    // 2) Update vehicle snapshot
    await Vehicle.findOneAndUpdate(
      { licensePlate: trip.vehicleNo },
      { lastKm: endKm, lastTotalizer: totalizerEnd }
    );

    // 3) Fetch all actual deliveries for this trip
    const deliveries = await Delivery.find({ tripId })
      .populate('orderId')
      .populate('customerId');

    if (deliveries.length === 0) {
      return res.status(400).json({ error: 'No deliveries made on this trip' });
    }

    // 4) Invoice each order
    const invoicePromises = deliveries.map(d => {
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
    });

    const invoices = await Promise.all(invoicePromises);

    // 5) Return both trip & generated invoices
    res.json({
      message:  'Trip closed and orders invoiced',
      trip,
      invoices
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:id/invoice
 * — Fetch the invoice for this trip and stream back a PDF
 */
/**
 * GET /api/trips/:id/invoice
 * — Stream back a PDF invoice for all deliveries on this trip
 */
router.get('/:id/invoice', async (req, res, next) => {
  try {
    const tripId = req.params.id;

    // 1) Fetch all deliveries for the trip
    const deliveries = await Delivery.find({ tripId })
      .populate('customerId', 'custName custCd')
      .lean();

    if (deliveries.length === 0) {
      return res.status(404).json({ error: 'No deliveries found for this trip' });
    }

    // 2) Start PDF stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice_${tripId}.pdf"`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // 3) Header
    doc.fontSize(20).text('Trip Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Trip ID: ${tripId}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // 4) Table Header
    doc.fontSize(12)
       .text('Customer',       50, doc.y, { continued: true })
       .text('Qty (L)',       250, doc.y, { width: 60, align: 'right', continued: true })
       .text('Rate',          330, doc.y, { width: 60, align: 'right', continued: true })
       .text('Amount',        410, doc.y, { width: 80, align: 'right' });
    doc.moveDown(0.5);

    // 5) Line Items
    let grandTotal = 0;
    deliveries.forEach(d => {
      const amount = d.qty * d.rate;
      grandTotal += amount;

      doc.text(d.customerId.custName,         50, doc.y, { continued: true })
         .text(d.qty.toString(),             250, doc.y, { width: 60, align: 'right', continued: true })
         .text(`₹${d.rate.toFixed(2)}`,      330, doc.y, { width: 60, align: 'right', continued: true })
         .text(`₹${amount.toFixed(2)}`,      410, doc.y, { width: 80, align: 'right' });
      doc.moveDown(0.2);
    });

    doc.moveDown();
    // 6) Total
    doc.fontSize(14).text(`Grand Total: ₹${grandTotal.toFixed(2)}`, {
      align: 'right'
    });

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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
