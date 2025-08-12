// models/Customer.js

const { Schema, model } = require('mongoose');

const CustomerSchema = new Schema({
  // DepotCd — Char(3), required, must be 3 digits
  depotCd: {
    type: String,
    required: true,
    match: [/^\d{3}$/, 'depotCd must be a 3-digit code']
  },

  // CustName — Char(20), required
  custName: {
    type: String,
    required: true,
    maxlength: 20,
    trim: true
  },

  // CustCd — Char(8), required
  custCd: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 3,
    trim: true,
    unique: true
  },

  // Mappings
  empCdMapped:    { type: String, trim: true },
  routeCdMapped:  { type: String, trim: true },

  // Billing address
  billToAdd1:     { type: String, maxlength: 30, trim: true },
  billToAdd2:     { type: String, maxlength: 30, trim: true },
  billToAdd3:     { type: String, maxlength: 30, trim: true },
  billArea:       { type: String, maxlength: 30, trim: true },
  billCity:       { type: String, maxlength: 20, trim: true },
  billPin:        { type: Number },
  billStateCd:    { type: Number, maxlength: 2, trim: true },

  // Shipping address 1
  shipTo1Add1:    { type: String, maxlength: 30, trim: true },
  shipTo1Add2:    { type: String, maxlength: 30, trim: true },
  shipTo1Add3:    { type: String, maxlength: 30, trim: true },
  shipTo1Area:    { type: String, maxlength: 30, trim: true },
  shipTo1City:    { type: String, maxlength: 20, trim: true },
  shipTo1Pin:     { type: Number },
  shipTo1StateCd: { type: String, maxlength: 2, trim: true },

  // Shipping address 2
  shipTo2Add1:    { type: String, maxlength: 30, trim: true },
  shipTo2Add2:    { type: String, maxlength: 30, trim: true },
  shipTo2Add3:    { type: String, maxlength: 30, trim: true },
  shipTo2Area:    { type: String, maxlength: 30, trim: true },
  shipTo2City:    { type: String, maxlength: 20, trim: true },
  shipTo2Pin:     { type: Number },
  shipTo2StateCd: { type: String, maxlength: 2, trim: true },

  // Tax/ID numbers
  custGST:   { type: String, trim: true },
  custPAN:   { type: String, trim: true },
  custPeso:  { type: String, maxlength: 30, trim: true },
  tradeLicNo:{ type: String, maxlength: 30, trim: true },

  // Status & agreement
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active',
    required: true
  },
  agreement: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No'
  },

  // Agreement validity & contact
  validity:      { type: Date },
  contactPerson: { type: String, trim: true },
  mobileNo:      { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = model('Customer', CustomerSchema);
