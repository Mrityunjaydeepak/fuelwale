const { Schema, model } = require('mongoose');
const TripSchema = new Schema({
  driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  route: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
  startTime: Date,
  endTime: Date,
  status: { type: String, enum: ['planned','in_progress','completed'], default: 'planned' }
}, { timestamps: true });
module.exports = model('Trip', TripSchema);
