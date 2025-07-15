// controllers/customerController.js
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const router = require('./userController');

// List customers
// - Admin (accessLevel 2): all customers
// - Sales (accessLevel 1): only those mapped to them
exports.listCustomers = async function(req, res, next) {
  try {
    const { empCd, accessLevel } = req.user;
    const filter = accessLevel === 2
      ? {}
      : { empCdMapped: empCd };

    const customers = await Customer.find(filter).lean();
    const result = customers.map(c => ({
      id:                c._id,
      custCd:            c.custCd,
      custName:          c.custName,
      status:            c.status,
      outstandingAmount: c.outstandingAmount,
      selectable:        c.status === 'Active',
      shipToAddresses:   [c.billToAdd1, c.billToAdd2, c.billToAdd3]
                            .filter(a => !!a)
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Get one customer by ID
// - Only admins or the employee it is mapped to
exports.getCustomer = async function(req, res, next) {
  try {
    const { empCd, accessLevel } = req.user;
    const customer = await Customer.findById(req.params.id).lean();
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
                            .filter(a => !!a)
    });
  } catch (err) {
    next(err);
  }
};

// Create a new customer (admin only)
exports.createCustomer = async function(req, res, next) {
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
      area,
      city,
      pin,
      stateCd,
      status,
    } = req.body;

    // 1) Require empCdMapped
    if (!empCdMapped) {
      return res
        .status(400)
        .json({ error: 'empCdMapped is required when creating a customer' });
    }

    // 2) Validate it refers to an existing Employee
    const emp = await Employee.findOne({ empCd: empCdMapped });
    if (!emp) {
      return res
        .status(400)
        .json({ error: `No employee found with empCd='${empCdMapped}'` });
    }

    // 3) Create the customer
    const newCustomer = await Customer.create({
      depotCd,
      custName,
      custCd,
      empCdMapped,    // guaranteed valid
      routeCdMapped,
      billToAdd1,
      billToAdd2,
      billToAdd3,
      area,
      city,
      pin,
      stateCd,
      status
    });

    res.status(201).json(newCustomer);
  } catch (err) {
    next(err);
  }
};

// Update an existing customer (admin only)
exports.updateCustomer = async function(req, res, next) {
  try {
    const updates = { ...req.body };

    // 1) If updating empCdMapped, validate it
    if (updates.empCdMapped) {
      const emp = await Employee.findOne({ empCd: updates.empCdMapped });
      if (!emp) {
        return res
          .status(400)
          .json({ error: `No employee found with empCd='${updates.empCdMapped}'` });
      }
    }

    // 2) Apply update
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).lean();

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


