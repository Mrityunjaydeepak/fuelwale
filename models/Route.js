// models/Route.js
const { Schema, model } = require('mongoose');

const RouteSchema = new Schema({
  name:  { type: String, required: true },
  depot: { type: Schema.Types.ObjectId, ref: 'Depot', required: true },

  // NEW: which loading stations are allowed for this route
  stationIds: [{ type: Schema.Types.ObjectId, ref: 'LoadingSource' }]
}, { timestamps: true });

module.exports = model('Route', RouteSchema);
