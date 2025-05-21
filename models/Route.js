const { Schema, model } = require('mongoose');
const RouteSchema = new Schema({
  name: { type: String, required: true },
  depot: { type: Schema.Types.ObjectId, ref: 'Depot', required: true }
}, { timestamps: true });
module.exports = model('Route', RouteSchema);
