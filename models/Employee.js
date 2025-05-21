const { Schema, model } = require('mongoose');

const EmployeeSchema = new Schema({
  empCd: { type: String, required: true },
  empName: { type: String, required: true },
  depotCd: { type: String, required: true },
  accessLevel: { type: Number, required: true }
}, { timestamps: true });

module.exports = model('Employee', EmployeeSchema);
