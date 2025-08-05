// models/User.js

const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const userSchema = new Schema({
  // For Employee / Driver / Customer / Admin
  userId: {
    type: String,
    required: true,
    unique: true,
    maxlength: 15,
    trim: true
  },

  // E = Employee, D = Driver, C = Customer, A = Admin
  userType: {
    type: String,
    required: true,
    enum: ['E','D','C','A']
  },

  // Initial password: user’s mobile number
  pwd: {
    type: String,
    required: true,
    
    trim: true
  },

  // Mobile number (10 digits)
  mobileNo: {
    type: String,
    required: true,
    match: [/^\d{10}$/, 'Mobile number must be 10 digits']
  },

  // Depot code (3 digits, 100–999)
  depotCd: {
    type: String,
    required: true,
    match: [/^[1-9]\d{2}$/, 'Depot code must be a 3-digit number from 100–999']
  },

  // Link to Employee, only if userType === 'E'
  employee: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: function() {
      return this.userType === 'E';
    }
  },

  // Link to Driver, only if userType === 'D'
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'Driver',
    required: function() {
      return this.userType === 'D';
    }
  },

  // Link to Customer, only if userType === 'C'
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: function() {
      return this.userType === 'C';
    }
  }

}, {
  timestamps: true
});

module.exports = model('User', userSchema);
