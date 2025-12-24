const Customer = require('../models/Customer');

function normalizeCustCd(value) {
  if (value == null) return value;
  const s = String(value).trim();
  if (/^c\d{6}$/i.test(s)) return `C${s.slice(1)}`;
  if (/^\d{6}$/.test(s)) return `C${s}`;
  return s;
}

function norm2(v) {
  if (v == null || v === '') return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  // allow "27" or 27 -> "27"
  const two = s.padStart(2, '0');
  return /^\d{2}$/.test(two) ? two : s;
}

exports.listCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const b = req.body || {};

    if (!b.depotCd || !b.custName || !b.custCd) {
      return res.status(400).json({ error: 'depotCd, custName and custCd are required' });
    }

    const customer = await Customer.create({
      ...b,
      custCd: normalizeCustCd(b.custCd),
      billStateCd: norm2(b.billStateCd),
      shipTo1StateCd: norm2(b.shipTo1StateCd),
      shipTo2StateCd: norm2(b.shipTo2StateCd),
      shipTo3StateCd: norm2(b.shipTo3StateCd),
      shipTo4StateCd: norm2(b.shipTo4StateCd),
      shipTo5StateCd: norm2(b.shipTo5StateCd),
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const updates = { ...(req.body || {}) };
    if (updates.custCd != null) updates.custCd = normalizeCustCd(updates.custCd);

    if (updates.billStateCd != null) updates.billStateCd = norm2(updates.billStateCd);
    for (const k of ['shipTo1StateCd','shipTo2StateCd','shipTo3StateCd','shipTo4StateCd','shipTo5StateCd']) {
      if (updates[k] != null) updates[k] = norm2(updates[k]);
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};
