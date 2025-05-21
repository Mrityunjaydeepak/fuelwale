const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');
const SalesAssociateSchema = new Schema({
  name: { type: String, required: true },
  depot: { type: Schema.Types.ObjectId, ref: 'Depot', required: true },
  pwd:       { type: String, required: true }     // ← new field
}, { timestamps: true });

// Hash their password before saving
SalesAssociateSchema.pre('save', async function(next) {
  if (!this.isModified('pwd')) return next();
  try {
    const hash = await bcrypt.hash(this.pwd, 10);
    this.pwd = hash;
    next();
  } catch (err) {
    next(err);
  }
});
module.exports = model('SalesAssociate', SalesAssociateSchema);
