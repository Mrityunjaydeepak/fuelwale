// models/Driver.js

const { Schema, model } = require('mongoose');

const DriverSchema = new Schema({
  driverName: {
    type: String,
    required: true,
    trim: true
  },

  profile: {
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  },

  depot: {
    type: Schema.Types.ObjectId,
    ref: 'Depot',
    required: true
  },

  // PESO license number (if applicable)
  pesoLicenseNo: {
    type: String,
    maxlength: 30,
    trim: true
  },

  // Driving license number
  licenseNumber: {
    type: String,
    maxlength: 20,
    trim: true
  }

}, {
  timestamps: true
});

module.exports = model('Driver', DriverSchema);
