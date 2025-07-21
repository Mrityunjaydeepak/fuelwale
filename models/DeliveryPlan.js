// models/DeliveryPlan.js
const { Schema, model, models } = require('mongoose');

const DeliveryPlanSchema = new Schema({
  tripId:      { type: Schema.Types.ObjectId, ref: 'Trip',     required: true },
  orderId:     { type: Schema.Types.ObjectId, ref: 'Order',    required: true },  // ← new
  customerId:  { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipTo:      { type: String,   required: true },
  requiredQty: { type: Number,   required: true }
}, {
  timestamps: true
});

module.exports = models.DeliveryPlan || model('DeliveryPlan', DeliveryPlanSchema);
