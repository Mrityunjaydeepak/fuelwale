const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const InvoiceSchema = new Schema({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  items: [
    {
      productName: { type: String, required: true },
      quantity:    { type: Number, required: true },
      rate:        { type: Number, required: true },
      amount:      { type: Number, required: true }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  dcNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = models.Invoice || model('Invoice', InvoiceSchema);
