const { Schema } = require('mongoose');
const OrderItemSchema = new Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
}, { _id: false });
module.exports = OrderItemSchema;
