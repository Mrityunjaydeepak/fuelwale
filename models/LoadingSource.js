const { Schema, model } = require('mongoose');

const LoadingSourceSchema = new Schema({
  loadSourceCd: { type: String, required: true, maxlength: 3 },
  name:        { type: String, required: true },
  add1: String, add2: String, add3: String,
  area: String, city: String, pin: Number,
  stateCd: { type: String, maxlength: 2 },

  // NEW: map routes on the source itself
  routeIds: [{ type: Schema.Types.ObjectId, ref: 'Route' }]
}, { timestamps: true });

LoadingSourceSchema.index({ routeIds: 1 }); // helpful

module.exports = model('LoadingSource', LoadingSourceSchema);
