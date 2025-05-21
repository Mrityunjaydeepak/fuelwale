const { Schema, model } = require('mongoose');

const LoadingSourceSchema = new Schema({
  loadSourceCd: { type: String, required: true, maxlength: 3 },
  name: { type: String, required: true },
  add1: { type: String },
  add2: { type: String },
  add3: { type: String },
  area: { type: String },
  city: { type: String },
  pin: { type: Number },
  stateCd: { type: String, maxlength: 2 }
}, { timestamps: true });

module.exports = model('LoadingSource', LoadingSourceSchema);
