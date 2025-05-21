const { Schema, model } = require('mongoose');

const BowserInventorySchema = new Schema({
  timeStamp: { type: Date, default: Date.now },
  vehicleNo: { type: String },
  depotCd: { type: String },
  opBal: { type: Number },
  trType: { type: String },
  trRef: { type: String },
  trQty: { type: Number },
  clStock: { type: Number }
}, { timestamps: true });

module.exports = model('BowserInventory', BowserInventorySchema);
