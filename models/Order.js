import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  salesOrderNo:     { type: String, required: true },
  custCd:           { type: String, required: true },
  productCd:        { type: String, required: true },
  orderQty:         { type: Number, required: true },
  deliveryDate:     { type: Date },
  deliveryTimeSlot: { type: String },

  // New fields:
  orderType: {
    type: String,
    enum: ['immediate', 'regular'],
    required: true,
    default: 'regular'
  },
  orderStatus: {
    type: String,
    enum: ['COMPLETED', 'PARTIALLY_COMPLETED', 'PENDING', 'CANCELLED'],
    required: true,
    default: 'PENDING'
  }
}, { timestamps: true });

export default mongoose.model('Order', OrderSchema);
