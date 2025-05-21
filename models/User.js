const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  userId: { type: String, required: true, maxlength: 15 },
  userType: { type: String, required: true, maxlength: 1 },
  pwd: { type: String, required: true }
}, { timestamps: true });

module.exports = model('User', UserSchema);
