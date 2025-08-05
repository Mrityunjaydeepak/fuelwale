// controllers/customerController.js

const Customer = require('../models/Customer');

/**
 * List all customers
 */
exports.listCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch one customer by ID
 */
exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new customer
 */
exports.createCustomer = async (req, res, next) => {
  try {
    const {
      depotCd,
      custName,
      custCd,
      empCdMapped,
      routeCdMapped,
      billToAdd1,
      billToAdd2,
      billToAdd3,
      billArea,
      billCity,
      billPin,
      billStateCd,
      shipTo1Add1,
      shipTo1Add2,
      shipTo1Add3,
      shipTo1Area,
      shipTo1City,
      shipTo1Pin,
      shipTo1StateCd,
      shipTo2Add1,
      shipTo2Add2,
      shipTo2Add3,
      shipTo2Area,
      shipTo2City,
      shipTo2Pin,
      shipTo2StateCd,
      custGST,
      custPAN,
      custPeso,
      tradeLicNo,
      status,
      agreement,
      validity,
      contactPerson,
      mobileNo
    } = req.body;

    // Validate required
    if (!depotCd || !custName || !custCd) {
      return res.status(400).json({
        error: 'depotCd, custName and custCd are required'
      });
    }

    const customer = await Customer.create({
      depotCd,
      custName,
      custCd,
      empCdMapped,
      routeCdMapped,
      billToAdd1,
      billToAdd2,
      billToAdd3,
      billArea,
      billCity,
      billPin,
      billStateCd,
      shipTo1Add1,
      shipTo1Add2,
      shipTo1Add3,
      shipTo1Area,
      shipTo1City,
      shipTo1Pin,
      shipTo1StateCd,
      shipTo2Add1,
      shipTo2Add2,
      shipTo2Add3,
      shipTo2Area,
      shipTo2City,
      shipTo2Pin,
      shipTo2StateCd,
      custGST,
      custPAN,
      custPeso,
      tradeLicNo,
      status,
      agreement,
      validity,
      contactPerson,
      mobileNo
    });

    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing customer
 */
exports.updateCustomer = async (req, res, next) => {
  try {
    const updates = {};
    for (let key of [
      'depotCd','custName','custCd','empCdMapped','routeCdMapped',
      'billToAdd1','billToAdd2','billToAdd3','billArea','billCity','billPin','billStateCd',
      'shipTo1Add1','shipTo1Add2','shipTo1Add3','shipTo1Area','shipTo1City','shipTo1Pin','shipTo1StateCd',
      'shipTo2Add1','shipTo2Add2','shipTo2Add3','shipTo2Area','shipTo2City','shipTo2Pin','shipTo2StateCd',
      'custGST','custPAN','custPeso','tradeLicNo','status','agreement','validity',
      'contactPerson','mobileNo'
    ]) {
      if (req.body[key] != null) updates[key] = req.body[key];
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
};

/**
 * Remove a customer
 */
exports.deleteCustomer = async (req, res, next) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};
