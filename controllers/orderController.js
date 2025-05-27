const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');

// GET /api/orders
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find({});
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
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
router.post('/', async (req, res, next) => {
  try {
    const {
      salesOrderNo,
      custCd,
      productCd,
      orderQty,
      deliveryDate,
      deliveryTimeSlot,
      orderType,     // ← new
      orderStatus    // ← new
    } = req.body;

    const newOrder = await Order.create({
      salesOrderNo,
      custCd,
      productCd,
      orderQty,
      deliveryDate,
      deliveryTimeSlot,
      orderType,     // will default to 'regular' if undefined
      orderStatus    // will default to 'PENDING' if undefined
    });

    res.status(201).json(newOrder);
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res, next) => {
  try {
    // allow updating all fields, including the new ones
    const updates = (({
      salesOrderNo,
      custCd,
      productCd,
      orderQty,
      deliveryDate,
      deliveryTimeSlot,
      orderType,
      orderStatus
    }) => ({
      salesOrderNo,
      custCd,
      productCd,
      orderQty,
      deliveryDate,
      deliveryTimeSlot,
      orderType,
      orderStatus
    }))(req.body);

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
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
