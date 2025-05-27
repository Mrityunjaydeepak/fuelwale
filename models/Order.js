const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  salesOrderNo:     { type: String, required: true },
  custCd:           { type: String, required: true },
  productCd:        { type: String, required: true },
  orderQty:         { type: Number, required: true },
  deliveryDate:     { type: Date },
  deliveryTimeSlot: { type: String },

  // New fields
  orderType: {
    type: String,
    enum: ['immediate', 'regular'],
    default: 'regular'
  },
  orderStatus: {
    type: String,
    enum: ['COMPLETED', 'PARTIALLY_COMPLETED', 'PENDING', 'CANCELLED'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
