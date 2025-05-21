const { Schema, model } = require('mongoose');
const VehicleSchema = new Schema({
  licensePlate: { type: String, required: true, unique: true },
  capacityLiters: { type: Number, required: true },
  depot: { type: Schema.Types.ObjectId, ref: 'Depot', required: true }
}, { timestamps: true });
module.exports = model('Vehicle', VehicleSchema);
