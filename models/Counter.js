
// models/Counter.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // name/key of the counter (e.g., "tripSerial")
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Counter', CounterSchema);
