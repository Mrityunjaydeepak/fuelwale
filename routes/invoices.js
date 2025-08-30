// src/routes/invoices.js
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const invoiceController = require('../controllers/invoiceController'); // <-- exports an Express router

const router = express.Router();

// 🔐 Protect everything here too (your controller also protects itself; double safe)
router.use(requireAuth);

// Mount all invoice routes from the controller:
//   GET  /                 -> list
//   GET  /:id              -> get one
//   GET  /prefill-from-trip/:tripId
//   POST /from-trip/:tripId
router.use('/', invoiceController);

module.exports = router;
