// models/PayRec.js
const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const TR_TYPES = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  DR: 'DR',
  CR: 'CR',
  TP_RECEIPT: '3P_RECEIPT',
  TP_PAYMENT: '3P_PAYMENT'
};
const TR_TYPES_ARRAY = Object.values(TR_TYPES);

const MODES = { BANK: 'BANK', CASH: 'CASH', ADJ_DR: 'ADJ_DR', ADJ_CR: 'ADJ_CR' };
const MODES_ARRAY = Object.values(MODES);

const STATUSES = { ACTIVE: 'ACTIVE', POSTED: 'POSTED', DELETED: 'DELETED' };
const STATUSES_ARRAY = Object.values(STATUSES);

const payRecSchema = new Schema(
  {
    date: { type: Date, required: true },
    trType: { type: String, required: true, enum: TR_TYPES_ARRAY },

    partyCode: { type: String, required: true, trim: true, index: true },
    partyName: { type: String, trim: true },

    forPartyCode: { type: String, trim: true, index: true },
    forPartyName: { type: String, trim: true },

    mode: { type: String, required: true, enum: MODES_ARRAY },
    refNo: { type: String, trim: true },

    amount: { type: Number, required: true, min: [0, 'Amount must be >= 0'] },

    remarks: { type: String, trim: true, maxlength: 500 },

    // 👉 NEW: Manager (Mgr)
    mgr: { type: String, trim: true, maxlength: 100, index: true }, // <— add this

    status: { type: String, enum: STATUSES_ARRAY, default: STATUSES.ACTIVE, index: true },

    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
    deletedAt: { type: Date },
    deletedBy: { type: String, trim: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Business rules unchanged...
payRecSchema.pre('validate', function (next) {
  const isThirdParty =
    this.trType === TR_TYPES.TP_RECEIPT || this.trType === TR_TYPES.TP_PAYMENT;

  if (isThirdParty) {
    if (!this.forPartyCode) return next(new Error('forPartyCode is required for 3P transactions'));
  } else {
    this.forPartyCode = this.partyCode;
    if (!this.forPartyName) this.forPartyName = this.partyName;
  }
  next();
});

payRecSchema.pre('save', function (next) {
  if (!this.forPartyName && this.forPartyCode === this.partyCode) {
    this.forPartyName = this.partyName;
  }
  next();
});

payRecSchema.index({ date: -1, _id: -1 });
payRecSchema.index({ partyCode: 1, date: -1 });
payRecSchema.index({ forPartyCode: 1, date: -1 });

payRecSchema.methods.softDelete = function (userId) {
  this.status = STATUSES.DELETED;
  this.deletedAt = new Date();
  this.deletedBy = userId || this.updatedBy || this.createdBy || null;
  this.updatedBy = userId || this.updatedBy || null;
  return this.save();
};

payRecSchema.methods.restore = function (userId) {
  this.status = STATUSES.ACTIVE;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.updatedBy = userId || this.updatedBy || null;
  return this.save();
};

const PayRec = model('PayRec', payRecSchema);
PayRec.TR_TYPES = TR_TYPES;
PayRec.MODES = MODES;
PayRec.STATUSES = STATUSES;

module.exports = PayRec;
