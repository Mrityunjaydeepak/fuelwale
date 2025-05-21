const { Schema, model } = require('mongoose');

const VehicleMasterSchema = new Schema({
  vehicleNo: { type: String, required: true, maxlength: 10 },
  depotCd: { type: String, required: true, maxlength: 4 },
  brand: { type: String },
  model: { type: String },
  calibratedCapacity: { type: Number },
  dipStickYesNo: { type: Boolean },
  gpsYesNo: { type: Boolean },
  loadSensorYesNo: { type: Boolean },
  route: { type: String }
}, { timestamps: true });

module.exports = model('VehicleMaster', VehicleMasterSchema);
