// models/LoadingAuth.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const LoadingAuthSchema = new Schema({
  tripId: {
    type: Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LoadingAuth', LoadingAuthSchema);
