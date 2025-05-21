const { Schema, model } = require('mongoose');

const OrderSchema = new Schema({
  salesOrderNo: { type: String, required: true },
  custCd: { type: String, required: true },
  productCd: { type: String, required: true },
  orderQty: { type: Number, required: true },
  deliveryDate: { type: Date },
  deliveryTimeSlot: { type: String }
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
