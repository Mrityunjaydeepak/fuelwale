// src/controllers/invoiceController.js

const pino    = require('pino');
const Order   = require('../models/Order');
const Invoice = require('../models/Invoice');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * POST /api/invoices
 * Create a new invoice for a delivered order
 */
exports.createInvoice = async (req, res, next) => {
  try {
    const { orderId, items } = req.body;
    const { empCd } = req.user;

    // 1) Fetch & validate order
    const order = await Order.findById(orderId).populate('customer');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 2) Build invoice line-items with amounts
    const invoiceItems = items.map(i => ({
      productName: i.productName,
      quantity:    i.quantity,
      rate:        i.rate,
      amount:      parseFloat((i.quantity * i.rate).toFixed(2))
    }));
    const totalAmount = invoiceItems.reduce((sum, i) => sum + i.amount, 0);

    // 3) Generate a unique DC number (swap for your util later)
    const dcNumber = `DC${Date.now()}`;

    // 4) Persist the invoice
    const invoice = await Invoice.create({
      order:       order._id,
      customer:    order.customer._id,
      items:       invoiceItems,
      totalAmount,
      dcNumber,
      invoiceDate: new Date()
    });

    logger.info({
      route:     'POST /api/invoices',
      invoiceId: invoice._id,
      by:        empCd
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/invoices
 * List all invoices
 */
exports.listInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find()
      .populate('order', 'shipToAddress deliveryDate')
      .populate('customer', 'custName')
      .lean();

    res.json(invoices);
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/invoices/:id
 * Fetch a single invoice by ID
 */
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('order', 'shipToAddress deliveryDate')
      .populate('customer', 'custName')
      .lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (err) {
    next(err);
  }
};
