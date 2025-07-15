// models/DeliveryPlan.js
const { Schema, model } = require('mongoose');

const DeliveryPlanSchema = new Schema({
  tripId:     { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipTo:     { type: String, required: true },
  requiredQty:{ type: Number, required: true },
}, {
  timestamps: true
});

module.exports = model('DeliveryPlan', DeliveryPlanSchema);
