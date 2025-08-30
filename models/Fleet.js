// models/Fleet.js
const { Schema, model } = require('mongoose');

/**
 * Fleet is the source of truth for "which driver is allotted to which vehicle".
 * One Fleet doc per Vehicle (vehicle is unique).
 * We also denormalize a few fields for easier filtering (depotCd, gpsYesNo).
 */
const FleetSchema = new Schema(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      unique: true,
      index: true,
    },

    // DriverAllotted (optional)
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true,
    },

    // Denormalized fields for fast filter/search (kept in sync on save/assign)
    depotCd: { type: String, trim: true, index: true },
    gpsYesNo: { type: Boolean, default: false },

    // Audit (optional)
    assignedAt: { type: Date },
    assignedBy: { type: String }, // empCd / user id if you have it
  },
  {
    timestamps: true,
  }
);

// Keep denormalized fields in sync if not previously set
FleetSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('depotCd') || !this.depotCd || !this.gpsYesNo) {
      // lazy load vehicle if needed
      const Vehicle = this.model('Vehicle');
      const v = await Vehicle.findById(this.vehicle).lean();
      if (v) {
        if (!this.depotCd && v.depotCd) this.depotCd = v.depotCd;
        if (this.gpsYesNo === undefined || this.gpsYesNo === null) {
          this.gpsYesNo = !!v.gpsYesNo;
        }
      }
    }
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = model('Fleet', FleetSchema);
