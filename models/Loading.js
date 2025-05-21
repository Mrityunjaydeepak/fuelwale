const { Schema, model } = require('mongoose');

const LoadingSchema = new Schema({
  vehicleNo: { type: String, required: true },
  depotCd: { type: String, required: true },
  loadingAuthorisationCd: { type: String },
  loadingSource: { type: String },
  driverCd: { type: String },
  productCd: { type: String },
  loadedQty: { type: Number },
  date: { type: Date },
  time: { type: String }
}, { timestamps: true });

module.exports = model('Loading', LoadingSchema);
