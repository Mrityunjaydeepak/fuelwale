// models/Vehicle.js

const { Schema, model } = require('mongoose');

const VehicleSchema = new Schema({
  // VehicleNo ‒ char(10)
  vehicleNo: {
    type: String,
    required: true,
    unique: true,
    maxlength: 10,
    trim: true
  },

  // DepotCd ‒ char(4)
  depotCd: {
    type: String,
    required: true,
    maxlength: 4,
    trim: true
  },

  // Brand
  brand: {
    type: String,
    trim: true
  },

  // Model
  model: {
    type: String,
    trim: true
  },

  // CalibratedCapacity (liters)
  calibratedCapacity: {
    type: Number
  },

  // DipStickYesNo
  dipStickYesNo: {
    type: Boolean,
    default: false
  },

  // GPSYesNo
  gpsYesNo: {
    type: Boolean,
    default: false
  },

  // LoadSensorYesNo
  loadSensorYesNo: {
    type: Boolean,
    default: false
  },

  // Route (references your Route collection)
  route: {
    type: Schema.Types.ObjectId,
    ref: 'Route'
  }
}, {
  timestamps: true
});

module.exports = model('Vehicle', VehicleSchema);
