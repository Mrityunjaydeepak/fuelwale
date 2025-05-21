const { Schema, model } = require('mongoose');
const InvoiceSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  driver: { type: Schema.Types.ObjectId, ref: 'Driver' },
  invoiceDate: { type: Date, default: Date.now },
  totalAmount: Number
}, { timestamps: true });
module.exports = model('Invoice', InvoiceSchema);
