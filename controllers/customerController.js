// controllers/customerController.js
const Customer = require('../models/Customer');

// List customers
// - Admin (accessLevel 2): all customers
// - Sales (accessLevel 1): only those mapped to them
exports.listCustomers = async function(req, res, next) {
  try {
    const empCd      = req.user.empCd;
    const accessLevel = req.user.accessLevel;
    const filter     = accessLevel === 2
      ? {}
      : { empCdMapped: empCd };

    const customers = await Customer.find(filter).lean();
    const result    = customers.map(function(c) {
      return {
        id:                c._id,
        custCd:            c.custCd,
        custName:          c.custName,
        status:            c.status,
        outstandingAmount: c.outstandingAmount,
        selectable:        c.status === 'Active',
        shipToAddresses:   [c.billToAdd1, c.billToAdd2, c.billToAdd3]
                              .filter(function(a) { return !!a; })
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Get one customer by ID
// - Only admins or the employee it is mapped to
exports.getCustomer = async function(req, res, next) {
  try {
    const empCd      = req.user.empCd;
    const accessLevel = req.user.accessLevel;
    const customer   = await Customer.findById(req.params.id).lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (accessLevel !== 2 && customer.empCdMapped !== empCd) {
      return res.status(403).json({ error: 'Not authorized for this customer' });
    }

    res.json({
      id:                customer._id,
      custCd:            customer.custCd,
      custName:          customer.custName,
      status:            customer.status,
      outstandingAmount: customer.outstandingAmount,
      shipToAddresses:   [customer.billToAdd1, customer.billToAdd2, customer.billToAdd3]
                            .filter(function(a) { return !!a; })
    });
  } catch (err) {
    next(err);
  }
};

// Create a new customer (admin only)
exports.createCustomer = async function(req, res, next) {
  try {
    const newCustomer = await Customer.create(req.body);
    res.status(201).json(newCustomer);
  } catch (err) {
    next(err);
  }
};

// Update an existing customer (admin only)
exports.updateCustomer = async function(req, res, next) {
  try {
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete a customer (admin only)
exports.deleteCustomer = async function(req, res, next) {
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
