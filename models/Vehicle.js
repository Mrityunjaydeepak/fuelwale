// models/Vehicle.js
const { Schema, model } = require('mongoose');

const VehicleSchema = new Schema(
  {
    vehicleNo: {
      type: String,
      required: true,
      unique: true,
      maxlength: 10,
      trim: true,
      set: (v) => String(v || '').toUpperCase().replace(/\s+/g, ''),
      index: true,
    },
    depotCd: {
      type: String,
      required: true,
      maxlength: 4,
      trim: true,
      set: (v) => String(v || '').toUpperCase(),
      index: true,
    },

    // Specs
    make: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    capacityLtrs: { type: Number, min: 0 },
    calibratedCapacity: { type: Number, min: 0 }, // legacy alias
    grossWtKgs: { type: Number, min: 0 },

    monthYear: {
      type: String, trim: true, default: '',
      validate: {
        validator: (v) => !v || /^\d{2}\/\d{4}$/.test(v) || /^\d{4}-\d{2}$/.test(v),
        message: 'monthYear must be "MM/YYYY" or "YYYY-MM"',
      },
    },
    totaliserMake: { type: String, trim: true, default: '' },
    totaliserModel: { type: String, trim: true, default: '' },

    gpsYesNo: { type: Boolean, default: false },
    volSensor: { type: Boolean, default: false },
    dipStickYesNo: { type: Boolean, default: false },
    loadSensorYesNo: { type: Boolean, default: false },

    pesoNo: { type: String, trim: true, default: '' },

    // Compliance dates
    insuranceExpiryDt: { type: Date, index: true },
    fitnessExpiryDt: { type: Date, index: true },
    permitExpiryDt: { type: Date, index: true },

    // Optional
    route: { type: Schema.Types.ObjectId, ref: 'Route' },

    // Allocation (to orders) — unchanged
    isAllocated: { type: Boolean, default: false, index: true },
    allocatedTo: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    allocatedAt: { type: Date },
    allocatedBy: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

VehicleSchema.virtual('last4').get(function () {
  return (this.vehicleNo || '').slice(-4);
});

VehicleSchema.statics.allocateToOrder = async function (vehicleId, orderId, by) {
  const updated = await this.findOneAndUpdate(
    { _id: vehicleId, isAllocated: { $ne: true } },
    { $set: { isAllocated: true, allocatedTo: orderId, allocatedAt: new Date(), allocatedBy: by || 'system' } },
    { new: true }
  );
  if (!updated) {
    const exists = await this.findById(vehicleId).lean();
    if (!exists) throw new Error('Vehicle not found');
    throw new Error('Vehicle already allocated');
  }
  return updated;
};

VehicleSchema.statics.releaseByOrder = async function (orderId) {
  return this.findOneAndUpdate(
    { allocatedTo: orderId },
    { $set: { isAllocated: false }, $unset: { allocatedTo: 1, allocatedAt: 1, allocatedBy: 1 } },
    { new: true }
  );
};

VehicleSchema.index({ vehicleNo: 1 }, { unique: true });
VehicleSchema.index({ depotCd: 1, isAllocated: 1 });
VehicleSchema.index({ insuranceExpiryDt: 1, fitnessExpiryDt: 1, permitExpiryDt: 1 });

module.exports = model('Vehicle', VehicleSchema);
