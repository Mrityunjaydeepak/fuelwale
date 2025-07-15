// models/Trip.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const tripSchema = new Schema({
  driverId:       { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  vehicleNo:      { type: String, required: true },
  capacity:       { type: Number, required: true },

  // ← Add "ASSIGNED" here
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

module.exports = mongoose.model('Trip', tripSchema);
