const { Schema, model } = require('mongoose');

const CustomerSchema = new Schema({
  // DepotCd — Char(3), required, must be 3 digits
  depotCd: {
    type: String,
    required: true,
    match: [/^\d{3}$/, 'depotCd must be a 3-digit code'],
    trim: true
  },

  // CustName — required
  custName: {
    type: String,
    required: true,
    maxlength: 50,
    trim: true
  },

  // CustCd — required (example: C271001)
  custCd: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 7,
    trim: true,
    unique: true
  },

  // ===== Missing fields from screenshot =====
  // Aadhaar No
  adharNo: { type: String, trim: true, maxlength: 20 },
  // Email Id
  emailId: { type: String, trim: true, lowercase: true, maxlength: 120 },
  // Category (manual text in screenshot)
  category: { type: String, trim: true, maxlength: 40 },
  // User Type (manual text in screenshot)
  userType: { type: String, trim: true, maxlength: 40 },
  // Mapped Sales (Sales Code / Online)
  mappedSales: { type: String, trim: true, maxlength: 40 },
  // Credit Period (Days)
  creditPeriodDays: { type: Number, min: 0 },
  // Remark
  remark: { type: String, trim: true, maxlength: 200 },

  // Mappings
  empCdMapped:   { type: String, trim: true },
  routeCdMapped: { type: String, trim: true },

  // Billing address
  billToAdd1:  { type: String, maxlength: 60, trim: true },
  billToAdd2:  { type: String, maxlength: 60, trim: true },
  billToAdd3:  { type: String, maxlength: 60, trim: true },
  billArea:    { type: String, maxlength: 30, trim: true },
  billCity:    { type: String, maxlength: 30, trim: true },

  billPin:     { type: Number },

  // IMPORTANT FIX:
  // You had billStateCd as Number with maxlength (invalid). Screenshot needs State + State Code.
  billState:   { type: String, trim: true, maxlength: 30 },
  billStateCd: { type: String, trim: true, match: [/^\d{2}$/, 'billStateCd must be 2 digits'] },

  // Shipping address 1..5
  shipTo1Add1:    { type: String, maxlength: 60, trim: true },
  shipTo1Add2:    { type: String, maxlength: 60, trim: true },
  shipTo1Add3:    { type: String, maxlength: 60, trim: true },
  shipTo1Area:    { type: String, maxlength: 30, trim: true },
  shipTo1City:    { type: String, maxlength: 30, trim: true },
  shipTo1Pin:     { type: Number },
  shipTo1StateCd: { type: String, maxlength: 2, trim: true },

  shipTo2Add1:    { type: String, maxlength: 60, trim: true },
  shipTo2Add2:    { type: String, maxlength: 60, trim: true },
  shipTo2Add3:    { type: String, maxlength: 60, trim: true },
  shipTo2Area:    { type: String, maxlength: 30, trim: true },
  shipTo2City:    { type: String, maxlength: 30, trim: true },
  shipTo2Pin:     { type: Number },
  shipTo2StateCd: { type: String, maxlength: 2, trim: true },

  shipTo3Add1:    { type: String, maxlength: 60, trim: true },
  shipTo3Add2:    { type: String, maxlength: 60, trim: true },
  shipTo3Add3:    { type: String, maxlength: 60, trim: true },
  shipTo3Area:    { type: String, maxlength: 30, trim: true },
  shipTo3City:    { type: String, maxlength: 30, trim: true },
  shipTo3Pin:     { type: Number },
  shipTo3StateCd: { type: String, maxlength: 2, trim: true },

  shipTo4Add1:    { type: String, maxlength: 60, trim: true },
  shipTo4Add2:    { type: String, maxlength: 60, trim: true },
  shipTo4Add3:    { type: String, maxlength: 60, trim: true },
  shipTo4Area:    { type: String, maxlength: 30, trim: true },
  shipTo4City:    { type: String, maxlength: 30, trim: true },
  shipTo4Pin:     { type: Number },
  shipTo4StateCd: { type: String, maxlength: 2, trim: true },

  shipTo5Add1:    { type: String, maxlength: 60, trim: true },
  shipTo5Add2:    { type: String, maxlength: 60, trim: true },
  shipTo5Add3:    { type: String, maxlength: 60, trim: true },
  shipTo5Area:    { type: String, maxlength: 30, trim: true },
  shipTo5City:    { type: String, maxlength: 30, trim: true },
  shipTo5Pin:     { type: Number },
  shipTo5StateCd: { type: String, maxlength: 2, trim: true },

  // Tax/ID numbers
  custGST:    { type: String, maxlength: 15, trim: true },
  custPAN:    { type: String, trim: true },
  custPeso:   { type: String, maxlength: 30, trim: true },
  tradeLicNo: { type: String, maxlength: 30, trim: true },

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
}, { timestamps: true });

module.exports = model('Customer', CustomerSchema);
