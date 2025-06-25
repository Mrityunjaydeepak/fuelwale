// routes/orders.js
const express = require('express');
const router  = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Customer = require('../models/Customer');
const Order    = require('../models/Order');

// 3.1 — Fetch mapped customers + status + outstanding + ship-to list
router.get('/customers', requireAuth, async (req, res, next) => {
  try {
    const empCd = req.user.empCd;
    const custs = await Customer.find({ empCdMapped: empCd });
    const result = custs.map(c => ({
      id:                 c._id,
      custCd:             c.custCd,
      custName:           c.custName,
      status:             c.status,
      selectable:         c.status === 'Active',
      outstandingAmount:  c.outstandingAmount,
      shipToAddresses:    [c.billToAdd1, c.billToAdd2, c.billToAdd3].filter(a => a),
    }));
    res.json(result);
  } catch (err) { next(err); }
});

// 3.2 — Place a new order
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

module.exports = router;
