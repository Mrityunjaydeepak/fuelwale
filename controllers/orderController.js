// controllers/orderController.js
const express     = require('express');
const router      = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Customer    = require('../models/Customer');
const Order       = require('../models/Order');

// Protect all order routes with JWT
router.use(requireAuth);

// Only sales (1) or admin (2) can use this
function requireSalesOrAdmin(req, res, next) {
  const lvl = req.user.accessLevel;
  if (lvl !== 1 && lvl !== 2) {
    return res
      .status(403)
      .json({ error: 'Orders are restricted to sales and administrators' });
  }
  next();
}

// GET /api/orders/customers
router.get(
  '/customers',
  requireSalesOrAdmin,
  async (req, res, next) => {
    try {
      const { empCd, accessLevel } = req.user;
      const filter = accessLevel === 2
        ? {}
        : { empCdMapped: empCd };

      const custs = await Customer.find(filter).lean();
      const result = custs.map(c => ({
        id:                c._id,
        custCd:            c.custCd,
        custName:          c.custName,
        status:            c.status,
        outstandingAmount: c.outstandingAmount,
        selectable:        c.status === 'Active',
        shipToAddresses:   [c.billToAdd1, c.billToAdd2, c.billToAdd3].filter(a => !!a)
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/orders
router.post(
  '/',
  requireSalesOrAdmin,
  async (req, res, next) => {
    // ---- DEBUG LOGGING ----
    console.log('>>> POST /api/orders'); 
    console.log('req.user:', req.user);
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    // ------------------------

    // Destructure request
    const { empCd } = req.user;
    const {
      customerId,
      shipToAddress,
      items,
      deliveryDate,
      deliveryTimeSlot
    } = req.body;

    // Validate presence of each field
    const missing = [];
    if (!customerId)      missing.push('customerId');
    if (!shipToAddress)   missing.push('shipToAddress');
    if (!items)           missing.push('items');
    if (!deliveryDate)    missing.push('deliveryDate');
    if (!deliveryTimeSlot)missing.push('deliveryTimeSlot');
    if (missing.length) {
      return res
        .status(400)
        .json({ error: `Missing fields in body: ${missing.join(', ')}` });
    }

    try {
      // 1) Check customer exists, mapped to this emp, and is Active
      const cust = await Customer.findOne({
        _id:          customerId,
        empCdMapped: empCd
      });
      if (!cust) {
        return res
          .status(403)
          .json({ error: 'Customer not accessible by this employee' });
      }
      if (cust.status !== 'Active') {
        return res
          .status(400)
          .json({ error: 'Cannot place order for inactive/suspended customer' });
      }

      // 2) Create the order
      const order = await Order.create({
        empCd,
        customer:       cust._id,
        shipToAddress,
        items:          items.map(i => ({
                           productName: 'diesel',
                           quantity:    i.quantity,
                           rate:        i.rate
                         })),
        deliveryDate:   new Date(deliveryDate),
        deliveryTimeSlot,
        confirmedAt:    new Date()
      });

      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
