const { Schema, model } = require('mongoose');
const DriverSchema = new Schema({
  driverName: { type: String, required: true },
  profile: { type: Schema.Types.ObjectId, ref: 'Employee' },
  depot: { type: Schema.Types.ObjectId, ref: 'Depot', required: true }
}, { timestamps: true });
module.exports = model('Driver', DriverSchema);
