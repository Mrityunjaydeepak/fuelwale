// models/Payment.js
const mongoose = require('mongoose');

const PAYMENT_STATUS = ['DRAFT', 'SUBMITTED', 'DELETED'];
const TRANS_TYPE     = ['RECEIPT', 'PAYMENT', 'ADJUSTMENT']; // tweak if you need others
const PAY_MODE       = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER'];

const PaymentSchema = new mongoose.Schema(
  {
    // core fields (table columns)
    transType:  { type: String, enum: TRANS_TYPE, required: true },          // TransType
    transName:  { type: String, trim: true, default: '' },                   // TransName (free label)
    custCd:     { type: String, trim: true, index: true },                   // CustCd (string code)
    custName:   { type: String, trim: true },                                // CustName (denorm for convenience)
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },   // optional FK

    amount:     { type: Number, min: 0, required: true },                    // Amount
    mode:       { type: String, enum: PAY_MODE, required: true },            // Mode (CASH/UPI/NEFT/RTGS/CHEQUE/CARD/OTHER)
    refNo:      { type: String, trim: true },                                // RefNo (UTR, Cheque no, etc.)
    remarks:    { type: String, trim: true, default: '' },                   // Remarks

    // bookkeeping
    status:     { type: String, enum: PAYMENT_STATUS, default: 'DRAFT', index: true },
    txDate:     { type: Date, default: Date.now },                           // user-chosen date of transaction
    submittedAt:{ type: Date },                                              // when moved to SUBMITTED
    deletedAt:  { type: Date },                                              // soft delete moment

    // optional linkages (handy for reporting)
    orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    tripId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },

    // audit
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// compound search helper index (custCd / refNo / transName)
PaymentSchema.index({ custCd: 1, refNo: 1, transName: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.TRANS_TYPE     = TRANS_TYPE;
module.exports.PAY_MODE       = PAY_MODE;
