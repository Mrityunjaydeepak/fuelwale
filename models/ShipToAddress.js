const { Schema, model } = require('mongoose');
const ShipToAddressSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  addressLine: { type: String, required: true },
  city: String,
  state: String,
  zip: String
}, { timestamps: true });
module.exports = model('ShipToAddress', ShipToAddressSchema);
