// models/Invoice.js
const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  productCode: { type: String },
  productName: { type: String, default: 'diesel' },
  quantity:    { type: Number, default: 0 },
  uom:         { type: String, default: 'Liter' },
  rate:        { type: Number, default: 0 },
  amount:      { type: Number, default: 0 }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  invoiceNo:   { type: String, index: true }, // optional
  invoiceDate: { type: Date, default: Date.now },

  // links
  tripId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  order:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  // denorm snapshots for stability
  customerSnap: {
    custCd: String, custName: String, address: String, shipToAddress: String,
    district: String, rsmName: String, receiverPhone: String
  },
  orderSnap: {
    referenceNo: String, paymentMethod: String, creditDays: Number,
    shipToAddress: String
  },
  vehicleSnap: {
    vehicleNo: String, routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' }
  },

  items:       { type: [InvoiceItemSchema], default: [] },
  subTotal:    { type: Number, default: 0 },    // before taxes/charges
  totalAmount: { type: Number, default: 0 },

  dcNumber:    { type: String },
  notes:       { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
