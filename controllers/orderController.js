// controllers/orderController.js

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const pino    = require('pino');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Order    = require('../models/Order');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// 📥 POST /api/orders — create a new order
router.post(
  '/',
  [
    body('customerId')
      .exists().withMessage('customerId is required')
      .bail()
      .isMongoId().withMessage('customerId must be a valid Mongo ID'),

    body('shipToAddress')
      .exists().withMessage('shipToAddress is required')
      .bail()
      .isString().withMessage('shipToAddress must be a string')
      .notEmpty().withMessage('shipToAddress cannot be empty'),

    body('items')
      .exists().withMessage('items is required')
      .bail()
      .isArray({ min: 1 }).withMessage('items must be a non-empty array'),

    body('items.*.productName')
      .exists().withMessage('productName is required for each item'),

    body('items.*.quantity')
      .exists().withMessage('quantity is required for each item')
      .bail()
      .isInt({ gt: 0 }).withMessage('quantity must be an integer > 0'),

    body('items.*.rate')
      .exists().withMessage('rate is required for each item')
      .bail()
      .isFloat({ gt: 0 }).withMessage('rate must be a number > 0'),

    body('deliveryDate')
      .exists().withMessage('deliveryDate is required')
      .bail()
      .isISO8601().withMessage('deliveryDate must be ISO 8601')
      .toDate(),

    body('deliveryTimeSlot')
      .exists().withMessage('deliveryTimeSlot is required')
      .bail()
      .matches(/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/)
      .withMessage('deliveryTimeSlot must be in format HH:MM - HH:MM'),

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    }
  ],
  async (req, res, next) => {
    const {
      customerId,
      shipToAddress,
      items,
      deliveryDate,
      deliveryTimeSlot
    } = req.body;

    logger.debug({
      route: 'POST /api/orders',
      body: req.body
    });

    try {
      // Validate time range
      const [start, end] = deliveryTimeSlot.split('-').map(t => t.trim());
      if (new Date(`1970-01-01T${start}:00Z`) >= new Date(`1970-01-01T${end}:00Z`)) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      // Fetch customer (no empCd restriction anymore)
      const cust = await Customer.findById(customerId);
      if (!cust) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      if (cust.status !== 'Active') {
        return res.status(400).json({ error: 'Cannot place order for inactive/suspended customer' });
      }

      // Save order
      const order = await Order.create({
        customer:       cust._id,
        shipToAddress,
        items:          items.map(i => ({
          productName: i.productName,
          quantity:    i.quantity,
          rate:        i.rate
        })),
        deliveryDate,
        deliveryTimeSlot,
        confirmedAt:    new Date()
      });

      res.status(201).json({
        id:               order._id,
        customer:         order.customer,
        shipToAddress:    order.shipToAddress,
        items:            order.items,
        deliveryDate:     order.deliveryDate,
        deliveryTimeSlot: order.deliveryTimeSlot,
        confirmedAt:      order.confirmedAt
      });
    } catch (err) {
      if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

// 🗑 DELETE /api/orders/:id — delete an order
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// 📤 GET /api/orders — list all orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .populate('customer', 'custCd custName')
      .lean();

   const result = orders.map(o => {
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    _id:          o._id,
    salesOrderNo: o._id.toString().slice(-6),
    createdAt:    o.createdAt,
    custCd:       o.customer?.custCd,
    orderQty:     items.reduce((sum, i) => sum + (i.quantity || 0), 0),
    orderType:    o.orderType || 'Regular',
    orderStatus:  o.orderStatus || 'PENDING'
  };
});


    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 👥 GET /api/orders/customers — list all customers
router.get('/customers', async (req, res, next) => {
  try {
    const custs = await Customer.find({}).lean();

    const result = custs.map(c => ({
      id:                c._id,
      custCd:            c.custCd,
      custName:          c.custName,
      status:            c.status,
      outstandingAmount: c.outstandingAmount,
      selectable:        c.status === 'Active',
      shipToAddresses:   [c.billToAdd1, c.billToAdd2, c.billToAdd3].filter(Boolean)
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 🔍 GET /api/orders/:id — fetch a single order’s full details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    const order = await Order.findById(id)
      .populate('customer', 'custCd custName empCdMapped')
      .lean();
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// 🔄 PUT /api/orders/:id — update order fields
router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.orderStatus) {
      updates.orderStatus = req.body.orderStatus;
    }
    // Add any other fields you want to allow updating
    const updated = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
