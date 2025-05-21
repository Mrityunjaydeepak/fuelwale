const { Schema, model } = require('mongoose');
const TripAssignmentSchema = new Schema({
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true }
}, { timestamps: true });
module.exports = model('TripAssignment', TripAssignmentSchema);
