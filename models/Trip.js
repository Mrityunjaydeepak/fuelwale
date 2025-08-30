// models/Trip.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const tripSchema = new Schema({
  // Final, server-generated trip number (prefix + sequential suffix)
  tripNo:        { type: String, required: true, unique: true },

  // We persist the order we seed plans from
  orderId:       { type: Schema.Types.ObjectId, ref: 'Order', required: true },

  // NEW: single source of truth for (driver+vehicle) at assignment time
  fleet:         { type: Schema.Types.ObjectId, ref: 'Fleet', required: true, index: true },

  // SNAPSHOTS (frozen at trip creation to preserve history & speed filters)
  snapshot: {
    driverId:   { type: Schema.Types.ObjectId, ref: 'Driver' }, // optional but recommended
    vehicleId:  { type: Schema.Types.ObjectId, ref: 'Vehicle' }, // if you want an ObjectId
    vehicleNo:  { type: String },        // denorm for quick search
    depotCd:    { type: String, index: true },
    gpsYesNo:   { type: Boolean },
    capacity:   { type: Number }         // if capacity belongs to vehicle
  },

  // Your original fields (keep 'capacity' if it is business-owned by Trip; 
  // otherwise put it in snapshot as above)
  capacity:      { type: Number, required: true }, // or remove if you rely only on snapshot.capacity

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
tripSchema.index({ fleet: 1, status: 1 });
tripSchema.index({ status: 1, createdAt: 1 });
// Optional: fast lookup by driver/vehicle at time of trip
tripSchema.index({ 'snapshot.driverId': 1, status: 1 });
tripSchema.index({ 'snapshot.vehicleNo': 1, status: 1 });

// Populate snapshot from Fleet at creation time
tripSchema.pre('validate', async function populateSnapshotFromFleet(next) {
  try {
    if (!this.isModified('fleet') || !this.fleet) return next();

    const Fleet = this.model('Fleet');
    const Vehicle = this.model('Vehicle');
    const Driver = this.model('Driver');

    const fleet = await Fleet.findById(this.fleet)
      .populate([
        { path: 'vehicle', select: '_id vehicleNo capacity depotCd gpsYesNo' },
        { path: 'driver',  select: '_id' }
      ])
      .lean();

    if (!fleet || !fleet.vehicle) {
      return next(new Error('Invalid fleet: vehicle is missing.'));
    }

    // snapshot basic stuff
    this.snapshot = this.snapshot || {};
    this.snapshot.driverId  = fleet.driver?._id || null;
    this.snapshot.vehicleId = fleet.vehicle?._id || null;
    this.snapshot.vehicleNo = fleet.vehicle?.vehicleNo || this.snapshot.vehicleNo;
    this.snapshot.depotCd   = fleet.depotCd ?? fleet.vehicle?.depotCd ?? this.snapshot.depotCd;
    this.snapshot.gpsYesNo  = typeof fleet.gpsYesNo === 'boolean'
      ? fleet.gpsYesNo
      : !!fleet.vehicle?.gpsYesNo;

    // snapshot capacity (from vehicle) only if not already set explicitly
    if (this.capacity == null && fleet.vehicle?.capacity != null) {
      this.capacity = fleet.vehicle.capacity;
    }
    if (this.snapshot.capacity == null && fleet.vehicle?.capacity != null) {
      this.snapshot.capacity = fleet.vehicle.capacity;
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Trip', tripSchema);
