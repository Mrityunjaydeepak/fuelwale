// models/Employee.js
const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const EmployeeSchema = new Schema({
  empCd:      { type: String, required: true, unique: true },
  empName:    { type: String, required: true },
  depotCd:    { type: String, required: true },
  accessLevel:{ type: Number, required: true },
  password:   { type: String, required: true },       // ← new
}, { timestamps: true });

// Hash password before saving
EmployeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to check password
EmployeeSchema.methods.verifyPassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = model('Employee', EmployeeSchema);
