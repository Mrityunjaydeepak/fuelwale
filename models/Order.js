const { Schema, model } = require('mongoose');

const OrderSchema = new Schema({
  empCd: { type: String },

  customer:      { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipToAddress: { type: String, required: true },

  // NEW: link the whole Fleet (vehicle+driver bundle)
  fleet: {
    type: Schema.Types.ObjectId,
    ref: 'Fleet',
    default: null,
    index: true,
  },

  // You can keep these mirrors for convenience (already in your schema)
  vehicle: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
    index: true,
  },
  vehicleRegNo: { type: String, default: '' },

  allocatedAt: { type: Date },
  allocatedBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },

  driver: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },

  // 🔢 Generated: SS DD ddmmyy RRR (13 digits total)
  orderNo: {
    type: String,
    required: true,
    unique: true,
    index: true,
    immutable: true,
    minlength: 13,
    maxlength: 13,
    match: /^\d{13}$/
  },

  orderNoMeta: {
    stateCode: { type: String },
    depotCode: { type: String },
    ddmmyy:    { type: String },
    run:       { type: Number }
  },

  items: [
    {
      productName: { type: String, default: 'diesel' },
      quantity:    { type: Number, required: true },
      rate:        { type: Number, required: true },
    }
  ],

  deliveryDate:     { type: Date, required: true },
  deliveryTimeSlot: { type: String, required: true },

  orderStatus: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },

  orderType: {
    type: String,
    enum: ['Regular', 'Express'],
    default: 'Regular'
  },

  confirmedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
