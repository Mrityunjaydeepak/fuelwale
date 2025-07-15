// models/LoadingMaster.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const LoadingMasterSchema = new Schema({
  routeId: {
    type: Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  stationId: {
    type: Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LoadingMaster', LoadingMasterSchema);
