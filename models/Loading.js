// src/models/Loading.js
const { Schema, model, models } = require('mongoose');

const LoadingSchema = new Schema({
  tripId:     { type: Schema.Types.ObjectId, ref: 'Trip',     required: true },
  stationId:  { type: Schema.Types.ObjectId, ref: 'Station',  required: true },
  product:    { type: String,   required: true },
  qty:        { type: Number,   required: true },
  vehicleNo:  { type: String },
  depotCd:    { type: String }
}, {
  timestamps: true
});

// Avoid OverwriteModelError if you hot-reload or reimport
module.exports = models.Loading || model('Loading', LoadingSchema);
