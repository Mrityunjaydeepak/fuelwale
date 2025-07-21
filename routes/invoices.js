// src/routes/invoices.js

const express           = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth       = require('../middleware/requireAuth');
const {
  createInvoice,
  listInvoices,
  getInvoice
} = require('../controllers/invoiceController');

const router = express.Router();

// 🔐 Protect all invoice routes
router.use(requireAuth);

// Validation chain for POST /api/invoices
const validateInvoice = [
  body('orderId')
    .exists().withMessage('orderId is required')
    .bail()
    .isMongoId().withMessage('orderId must be a valid Mongo ID'),

  body('items')
    .exists().withMessage('items is required')
    .bail()
    .isArray({ min: 1 }).withMessage('items must be a non-empty array'),

  body('items.*.productName')
    .exists().withMessage('productName is required for each item'),

  body('items.*.quantity')
    .exists().withMessage('quantity is required for each item')
    .bail()
    .isFloat({ gt: 0 }).withMessage('quantity must be a number > 0'),

  body('items.*.rate')
    .exists().withMessage('rate is required for each item')
    .bail()
    .isFloat({ gt: 0 }).withMessage('rate must be a number > 0'),

  // Handle validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// POST → create invoice
router.post('/', validateInvoice, createInvoice);

// GET → list all invoices
router.get('/', listInvoices);

// GET → single invoice by ID
router.get('/:id', getInvoice);

module.exports = router;
