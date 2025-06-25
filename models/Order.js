// models/Order.js
const { Schema, model } = require('mongoose');

const OrderSchema = new Schema({
  empCd:            { type: String, required: true },
  customer:         { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipToAddress:    { type: String, required: true },
  items: [
    {
      productName:  { type: String, default: 'diesel' },
      quantity:     { type: Number, required: true },
      rate:         { type: Number, required: true },
    }
  ],
  deliveryDate:     { type: Date,   required: true },
  deliveryTimeSlot: { type: String, required: true },
  confirmedAt:      { type: Date,   default: Date.now },
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
