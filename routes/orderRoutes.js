// routes/orders.js
const express = require('express');
const router  = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Customer = require('../models/Customer');
const Order    = require('../models/Order');

/** helper: build a printable multi-line address from Customer fields */
function buildShipTo(c, n) {
  const A1 = c[`shipTo${n}Add1`];
  const A2 = c[`shipTo${n}Add2`];
  const A3 = c[`shipTo${n}Add3`];
  const AR = c[`shipTo${n}Area`];
  const CT = c[`shipTo${n}City`];
  const PN = c[`shipTo${n}Pin`];
  const ST = c[`shipTo${n}StateCd`];

  const hasAnything =
    [A1, A2, A3, AR, CT, PN, ST].some(v => v !== undefined && v !== null && String(v).trim() !== '');

  if (!hasAnything) return null;

  const lines = [];
  const line1 = [A1, A2, A3].filter(Boolean).join(', ');
  if (line1) lines.push(line1);
  const line2 = [AR, CT].filter(Boolean).join(', ');
  if (line2) lines.push(line2);
  const line3 = [PN, ST].filter(Boolean).join(', ');
  if (line3) lines.push(line3);

  return lines.join('\n');
}

/** helper: gather up to 5 ship-to addresses (multi-line strings) */
function collectShipTos(c) {
  const arr = [];
  for (let i = 1; i <= 5; i++) {
    const s = buildShipTo(c, i);
    if (s) arr.push(s);
  }
  return arr;
}

/** 3.1 — Fetch mapped customers + status + outstanding + all 5 ship-to addresses */
router.get('/customers', requireAuth, async (req, res, next) => {
  try {
    const empCd = req.user.empCd;
    const custs = await Customer.find({ empCdMapped: empCd });

    const result = custs.map(c => ({
      id:                c._id,
      custCd:            c.custCd,
      custName:          c.custName,
      status:            c.status,
      selectable:        c.status === 'Active',
      outstandingAmount: c.outstandingAmount ?? c.outstanding ?? 0,
      // Provide up to 5 shipping addresses, formatted
      shipToAddresses:   collectShipTos(c)
    }));

    res.json(result);
  } catch (err) { next(err); }
});

/** GET /orders — list orders for this employee's mapped customers (new, used by TripManager) */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const empCd = req.user.empCd;

    // customers mapped to this employee
    const custs = await Customer.find({ empCdMapped: empCd }).select('_id');
    const custIds = custs.map(c => c._id);

    // return orders of those customers (you can also include { empCd } if you want)
    const orders = await Order.find({ customer: { $in: custIds } })
      .populate('customer', 'custName custCd')
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (err) { next(err); }
});

/** 3.2 — Place a new order (unchanged) */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const empCd = req.user.empCd;
    const { customerId, shipToAddress, items, deliveryDate, deliveryTimeSlot } = req.body;

    // 1) ensure this customer belongs to the emp & is Active
    const cust = await Customer.findOne({ _id: customerId, empCdMapped: empCd });
    if (!cust) return res.status(403).json({ error: 'Customer not accessible' });
    if (cust.status !== 'Active')
      return res.status(400).json({ error: 'Cannot order for inactive/suspended customer' });

    // 2) create the order
    // NOTE: assuming your system generates orderNo elsewhere (hook/service).
    const order = await Order.create({
      empCd,
      customer:         cust._id,
      shipToAddress,
      items,
      deliveryDate,
      deliveryTimeSlot,
      confirmedAt:      new Date(),
    });

    res.status(201).json(order);
  } catch (err) { next(err); }
});

/**
 * PATCH /orders/:id/status — update orderStatus (PENDING, ASSIGNED, etc.)
 * Keep this route ABOVE any generic '/:id' routes.
 */
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const allowed = ['PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED', 'ASSIGNED'];
    if (!allowed.includes(orderStatus)) {
      return res.status(400).json({ error: 'Invalid orderStatus' });
    }

    // Optional guard: only allow status change if order belongs to an accessible customer
    const empCd = req.user.empCd;
    const order = await Order.findById(req.params.id).select('customer');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const cust = await Customer.findOne({ _id: order.customer, empCdMapped: empCd }).select('_id');
    if (!cust) return res.status(403).json({ error: 'Not allowed for this order' });

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { orderStatus, allocatedAt: orderStatus === 'ASSIGNED' ? new Date() : undefined } },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
