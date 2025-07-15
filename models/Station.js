const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const StationSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    type: String, // e.g. address or description
    default: ''
  }
}, {
  timestamps: true
});

module.exports = model('Station', StationSchema);
