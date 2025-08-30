// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema, model } = mongoose;

/**
 * We are removing `roles` entirely.
 * Authorization will be based ONLY on `userType`.
 * Added app-specific user types: Vehicle Allocation, Trips, Accounts.
 */
const USER_TYPES = {
  EMPLOYEE: 'E',
  DRIVER: 'D',
  CUSTOMER: 'C',
  ADMIN: 'A',
  VEHICLE_ALLOCATION: 'VA',
  TRIPS: 'TR',
  ACCOUNTS: 'AC'
};

const userSchema = new Schema(
  {
    // For Employee / Driver / Customer / Admin / VA / TR / AC
    userId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 15,
      trim: true,
      index: true
    },

    // E=Employee, D=Driver, C=Customer, A=Admin, VA=Vehicle Allocation, TR=Trips, AC=Accounts
    userType: {
      type: String,
      required: true,
      enum: Object.values(USER_TYPES)
    },

    // Store HASH, never plain text
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

    // Links to domain entities (only for E/D/C types)
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: function () {
        return this.userType === USER_TYPES.EMPLOYEE;
      }
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: function () {
        return this.userType === USER_TYPES.DRIVER;
      }
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: function () {
        return this.userType === USER_TYPES.CUSTOMER;
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.pwd; // never expose password hash
        delete ret.__v;
        return ret;
      }
    }
  }
);

// ---------- Hooks ----------
userSchema.pre('save', async function (next) {
  if (!this.isModified('pwd')) return next();
  const salt = await bcrypt.genSalt(10);
  this.pwd = await bcrypt.hash(this.pwd, salt);
  next();
});

// ---------- Instance helpers ----------
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.pwd);
};

const User = model('User', userSchema);

// Export enum so the rest of the app can reference canonical values
User.USER_TYPES = USER_TYPES;

module.exports = User;
