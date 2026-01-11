const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');
const requireAuth = require('../middleware/requireAuth');

// 🔐 if you want only authenticated users:
// router.use(requireAuth);

/**
 * GET /api/products
 * List all products
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Fetch a single product
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Create a new product
 */
router.post('/', async (req, res, next) => {
  try {
    const { name  } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const product = await Product.create({ name  });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/products/:id
 * Update an existing product
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name != null)     updates.name     = req.body.name;
   

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id
 * Remove a product
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
