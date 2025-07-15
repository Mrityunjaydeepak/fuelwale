// models/Vehicle.js

const { Schema, model } = require('mongoose');

const VehicleSchema = new Schema({
  licensePlate:   { type: String, required: true, unique: true },
  capacityLiters: { type: Number, required: true },
  depot:          { type: Schema.Types.ObjectId, ref: 'Depot', required: true },
  lastKm:         { type: Number, default: 0 },    // ← last trip’s end KM
  lastTotalizer:  { type: Number, default: 0 }     // ← last trip’s end totalizer
}, { timestamps: true });

module.exports = model('Vehicle', VehicleSchema);
