const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const ProductSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

module.exports = model('Product', ProductSchema);
