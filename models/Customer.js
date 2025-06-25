const { Schema, model } = require('mongoose');

const CustomerSchema = new Schema({
  depotCd: { type: String, required: true },
  custName: { type: String, required: true, maxlength: 20 },
  custCd: { type: String, required: true, maxlength: 8 },
  empCdMapped: { type: String },
  routeCdMapped: { type: String },
  billToAdd1: { type: String, maxlength: 30 },
  billToAdd2: { type: String, maxlength: 30 },
  billToAdd3: { type: String, maxlength: 30 },
  area: { type: String, maxlength: 30 },
  city: { type: String, maxlength: 20 },
  pin: { type: Number },
  stateCd: { type: String, maxlength: 2 },
  status:           { 
   type: String, 
   enum: ['Active','Inactive','Suspended'], 
   default: 'Active',
   required: true
 },
 outstandingAmount:{ 
   type: Number, 
   default: 0 
 },
}, { timestamps: true });

module.exports = model('Customer', CustomerSchema);
