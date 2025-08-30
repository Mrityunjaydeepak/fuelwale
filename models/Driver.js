// models/Driver.js
const { Schema, model } = require('mongoose');

const DriverSchema = new Schema(
  {
    driverName:    { type: String, required: true, trim: true },
    // ⬇️ CHANGED: reference Employee instead of Profile
    profile:       { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    depot:         { type: Schema.Types.ObjectId, ref: 'Depot', default: null },
    pesoLicenseNo: { type: String, trim: true, default: '' },
    licenseNumber: { type: String, trim: true, default: '' },

    // live trip linkage (set by Trip controller)
    currentTrip:  { type: Schema.Types.ObjectId, ref: 'Trip', default: null, index: true },
    currentTripStatus: {
      type: String,
      enum: ['ASSIGNED', 'ACTIVE', 'COMPLETED'],
      default: undefined // tolerant of null/undefined
    }
  },
  { timestamps: true }
);

DriverSchema.index({ depot: 1 });
DriverSchema.index({ driverName: 1, pesoLicenseNo: 1 });

DriverSchema.pre('save', function (next) {
  if (this.pesoLicenseNo != null) this.pesoLicenseNo = String(this.pesoLicenseNo).trim();
  if (this.licenseNumber != null) this.licenseNumber = String(this.licenseNumber).trim();
  next();
});

module.exports = model('Driver', DriverSchema);
