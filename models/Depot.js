const { Schema, model } = require('mongoose');

const DepotSchema = new Schema({
  depotCd: { type: String, required: true, maxlength: 3 },
  depotName: { type: String, required: true, maxlength: 20 },
  depotAdd1: { type: String, maxlength: 30 },
  depotAdd2: { type: String, maxlength: 30 },
  depotAdd3: { type: String, maxlength: 30 },
  depotArea: { type: String, maxlength: 30 },
  city: { type: String, maxlength: 20 },
  pin: { type: Number },
  stateCd: { type: String, maxlength: 2 }
}, { timestamps: true });

module.exports = model('Depot', DepotSchema);
