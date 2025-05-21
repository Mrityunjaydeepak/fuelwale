// controllers/employeeController.js
const express = require('express');
const router  = express.Router();
const Employee = require('../models/Employee');

// GET /api/employees
router.get('/', async (req, res, next) => {
  try {
    const list = await Employee.find().populate('depotCd');
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees
router.post('/', async (req, res, next) => {
  try {
    const { empCd, empName, depot, accessLevel } = req.body;
    // map depot to depotCd
    const item = await Employee.create({
      empCd,
      empName,
      depotCd: depot,
      accessLevel
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { empCd, empName, depot, accessLevel } = req.body;
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { empCd, empName, depotCd: depot, accessLevel },
      { new: true }
    ).populate('depotCd');
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
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