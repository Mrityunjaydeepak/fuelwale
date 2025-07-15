// models/Delivery.js
const { Schema, model } = require('mongoose');

const DeliverySchema = new Schema({
  tripId:     { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipTo:     { type: String, required: true },
  qty:        { type: Number, required: true },
  rate:       { type: Number, required: true },
  deliveredAt:{ type: Date,   default: Date.now },
  dcNo:       { type: String },
}, {
  timestamps: true
});

module.exports = model('Delivery', DeliverySchema);
