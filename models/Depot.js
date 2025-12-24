const { Schema, model } = require('mongoose');

const DepotSchema = new Schema(
  {
    depotCd: { type: String, required: true, maxlength: 3, trim: true },
    depotName: { type: String, required: true, maxlength: 20, trim: true },

    depotAdd1: { type: String, maxlength: 30, trim: true },
    depotAdd2: { type: String, maxlength: 30, trim: true },
    depotAdd3: { type: String, maxlength: 30, trim: true },
    depotArea: { type: String, maxlength: 30, trim: true },
    city: { type: String, maxlength: 20, trim: true },
    pin: { type: Number },
    stateCd: { type: String, maxlength: 2, trim: true },

    gstin: {
      type: String,
      maxlength: 15,
      uppercase: true,
      trim: true,
      match: [
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        'Invalid GSTIN format'
      ]
    },

    contactNo: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, 'Contact number must be 10 digits']
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },

    contactName: { type: String, trim: true, maxlength: 30 },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  { timestamps: true }
);

/**
 * REQUIRED unique indexes
 */
DepotSchema.index({ depotCd: 1 }, { unique: true });
DepotSchema.index({ depotName: 1 }, { unique: true });

/**
 * OPTIONAL-but-unique-when-present indexes
 * (prevents duplicate key errors for missing/empty values)
 */
DepotSchema.index(
  { gstin: 1 },
  {
    unique: true,
    partialFilterExpression: { gstin: { $type: 'string', $ne: '' } }
  }
);

DepotSchema.index(
  { contactNo: 1 },
  {
    unique: true,
    partialFilterExpression: { contactNo: { $type: 'string', $ne: '' } }
  }
);

DepotSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string', $ne: '' } }
  }
);

module.exports = model('Depot', DepotSchema);
