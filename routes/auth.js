// routes/auth.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const Employee = require('../models/Employee');
const router  = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { empCd, password } = req.body;
  if (!empCd || !password) {
    return res.status(400).json({ error: 'empCd and password required' });
  }

  const emp = await Employee.findOne({ empCd });
  if (!emp) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await emp.verifyPassword(password);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Map your accessLevel to a userType that requireAdmin expects:
  // (e.g. accessLevel===2 → admin, else sales)
  const userType = emp.accessLevel === 2 ? 'A' : 'S';

  // Build a token payload
  const payload = {
    userId:      emp._id,
    empCd:       emp.empCd,
    accessLevel: emp.accessLevel,
    userType,                              
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });

  res.json({ token });
});



// in routes/auth.js, below your /login route add:

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { empCd, empName, depotCd, accessLevel, password } = req.body;
  if (!empCd || !empName || !depotCd || accessLevel == null || !password) {
    return res.status(400).json({ error: 'empCd, empName, depotCd, accessLevel and password are required' });
  }

  // Prevent duplicate empCd
  if (await Employee.findOne({ empCd })) {
    return res.status(409).json({ error: 'empCd already in use' });
  }

  const emp = await Employee.create({ empCd, empName, depotCd, accessLevel, password });
  // don’t return the password hash!
  const { password: _, ...safe } = emp.toObject();
  res.status(201).json(safe);
});

module.exports = router;
