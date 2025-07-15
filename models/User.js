const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  userId:   { type: String, required: true, unique: true },
  userType: { type: String, enum: ['a','s','d'], required: true },
  pwd:      { type: String, required: true },

  employee: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: function() {
      // only admins ('a') or sales ('s') need an employee link
      return this.userType === 'a' || this.userType === 's';
    }
  },

  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Driver',
    required: function() {
      // only driver‐type users ('d') need a driver link
      return this.userType === 'd';
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
