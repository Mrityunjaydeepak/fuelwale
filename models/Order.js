const { Schema, model } = require('mongoose');

const OrderSchema = new Schema({
  empCd:            { type: String},
  customer:         { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  shipToAddress:    { type: String, required: true },
  items: [
    {
      productName:  { type: String, default: 'diesel' },
      quantity:     { type: Number, required: true },
      rate:         { type: Number, required: true },
    }
  ],
  deliveryDate:     { type: Date, required: true },
  deliveryTimeSlot: { type: String, required: true },

  // ✅ Add orderStatus
  orderStatus: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },

  // ✅ Add orderType
  orderType: {
    type: String,
    enum: ['Regular', 'Express'],
    default: 'Regular'
  },

  confirmedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = model('Order', OrderSchema);
