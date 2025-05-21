const { Schema, model } = require('mongoose');

const PaymentReceivedSchema = new Schema({
  custCd: { type: String },
  paymentType: { type: String },
  refNo: { type: String },
  amount: { type: Number },
  date: { type: Date },
  time: { type: String }
}, { timestamps: true });

module.exports = model('PaymentReceived', PaymentReceivedSchema);
