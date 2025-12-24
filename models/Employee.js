// models/Employee.js
const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

// Allowed roles for employees
const ROLES = ['admin', 'trip', 'vehicle', 'accounts', 'customer'];

const EmployeeSchema = new Schema(
  {
    empCd:       { type: String, required: true, unique: true, trim: true },
    empName:     { type: String, required: true, trim: true },
    depotCd:     { type: String, trim: true },
    accessLevel: { type: Number,  min: 0 },
    status:      {type:String},

    // NEW: roles (supports multiple roles)
    roles: {
      type: [String],
      enum: ROLES,
      default: ['customer'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one role is required.'
      }
    },

    // Added because your pre-save hook hashes "password"
    // Note: `select: false` means you must `.select("+password")` when loading a user for login checks
    password: { type: String, required: true, minlength: 6, select: false }
  },
  { timestamps: true }
);

// Hash password before saving
EmployeeSchema.pre('save', async function (next) {
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
// Make sure the document was loaded with `.select("+password")` before calling this
EmployeeSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Helper: check if employee has a specific role
EmployeeSchema.methods.hasRole = function (role) {
  return Array.isArray(this.roles) && this.roles.includes(role);
};

// Expose roles enum on the model for reuse elsewhere
EmployeeSchema.statics.ROLES = ROLES;

module.exports = model('Employee', EmployeeSchema);
