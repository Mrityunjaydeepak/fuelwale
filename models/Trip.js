// models/Trip.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const tripSchema = new Schema({
  // Final, server-generated trip number (prefix + sequential suffix)
  tripNo:        { type: String, required: true, unique: true },

  // We persist the order we seed plans from
  orderId:       { type: Schema.Types.ObjectId, ref: 'Order', required: true },

  driverId:      { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  vehicleNo:     { type: String, required: true },
  capacity:      { type: Number, required: true },

  status: {
    type: String,
    enum: ['ASSIGNED', 'ACTIVE', 'COMPLETED'],
    default: 'ASSIGNED'
  },

  assigned:       { type: Boolean, default: true },
  routeId:        { type: Schema.Types.ObjectId, ref: 'Route' },
  remarks:        String,

  startKm:        Number,
  totalizerStart: Number,
  dieselOpening:  Number,
  loginTime:      Date,

  endKm:          Number,
  totalizerEnd:   Number,
  logoutTime:     Date
}, {
  timestamps: true
});

// Helpful indexes
tripSchema.index({ tripNo: 1 }, { unique: true });
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Trip', tripSchema);
