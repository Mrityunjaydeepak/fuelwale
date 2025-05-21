const { Schema, model } = require('mongoose');
const LoadingStationSchema = new Schema({
  name: { type: String, required: true },
  route: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
  address: String
}, { timestamps: true });
module.exports = model('LoadingStation', LoadingStationSchema);
