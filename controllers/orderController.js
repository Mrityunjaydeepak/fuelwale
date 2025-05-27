const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');

// GET /api/orders
// Return all orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find({});
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
// Return a single order by ID
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
// Create a new order
router.post('/', async (req, res, next) => {
  try {
    const { salesOrderNo, custCd, productCd, orderQty, deliveryDate, deliveryTimeSlot } = req.body;
    const newOrder = await Order.create({ salesOrderNo, custCd, productCd, orderQty, deliveryDate, deliveryTimeSlot });
    res.status(201).json(newOrder);
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id
// Update an existing order
router.put('/:id', async (req, res, next) => {
  try {
    const updates = req.body;
    const updated = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
// Remove an order
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
