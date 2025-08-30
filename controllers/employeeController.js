// controllers/employeeController.js
const express = require('express');
const router  = express.Router();
const Employee = require('../models/Employee');

// GET /api/employees
// Note: If depotCd is NOT a ref in your schema, strictPopulate:false prevents errors
router.get('/', async (req, res, next) => {
  try {
    const list = await Employee.find()
      .populate({ path: 'depotCd', strictPopulate: false });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees
// Body: { empCd, empName, depot, accessLevel, roles?, password }
router.post('/', async (req, res, next) => {
  try {
    const { empCd, empName, depot, accessLevel, roles, password } = req.body;

    const item = await Employee.create({
      empCd,
      empName,
      depotCd: depot ?? null,
      accessLevel,
      roles,         // validated by enum in schema; defaults if not provided
      password       // required by schema
    });

    // password has select:false and won’t be returned
    res.status(201).json(item);
  } catch (err) {
    // Handle duplicate empCd nicely
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'empCd already exists' });
    }
    // Validation error
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// PUT /api/employees/:id
// Allows partial updates; if password is provided, it will be hashed (we load & save doc)
router.put('/:id', async (req, res, next) => {
  try {
    const { empCd, empName, depot, accessLevel, roles, password } = req.body;

    const doc = await Employee.findById(req.params.id).select('+password'); // ensure password present if updating
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (typeof empCd !== 'undefined') doc.empCd = empCd;
    if (typeof empName !== 'undefined') doc.empName = empName;
    if (typeof depot !== 'undefined') doc.depotCd = depot;
    if (typeof accessLevel !== 'undefined') doc.accessLevel = accessLevel;
    if (typeof roles !== 'undefined') doc.roles = roles;
    if (typeof password !== 'undefined' && password) doc.password = password; // triggers pre('save') hash

    await doc.save();

    // Re-fetch populated view without password
    const updated = await Employee.findById(doc._id)
      .populate({ path: 'depotCd', strictPopulate: false });

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'empCd already exists' });
    }
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const d = await Employee.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
