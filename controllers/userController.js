// controllers/userController.js

const express     = require('express');
const router      = express.Router();
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');

const User        = require('../models/User');
const Employee    = require('../models/Employee');
const Driver      = require('../models/Driver');
const Trip        = require('../models/Trip');
const requireAuth = require('../middleware/requireAuth');

// ——— POST /api/users/login — authenticate & issue JWT ———
router.post('/login', async (req, res, next) => {
  try {
    const { userId, pwd } = req.body;
    if (!userId || !pwd) {
      return res.status(400).json({ error: 'userId and pwd are required' });
    }

    // 1) Find user with Employee & Driver populated
    const user = await User.findOne({ userId })
      .populate('employee', 'empCd accessLevel')
      .populate('driver',   '_id');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2) Verify password
    const match = await bcrypt.compare(pwd, user.pwd);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ── NEW: Allow driver to log in if they have an ASSIGNED *or* ACTIVE trip ──
    if (user.userType === 'd') {
      const hasTrip = await Trip.findOne({
        driverId: user.driver._id,
        status: { $in: ['ASSIGNED', 'ACTIVE'] }
      });
      if (!hasTrip) {
        return res
          .status(403)
          .json({ error: 'No trips assigned to you. Please check back later.' });
      }
    }

    // 3) Build JWT payload
    const payload = {
      id:       user._id,
      userType: user.userType
    };
    if (user.employee) {
      payload.empCd       = user.employee.empCd;
      payload.accessLevel = user.employee.accessLevel;
    }
    if (user.driver) {
      payload.driverId    = user.driver._id;
    }

    // 4) Sign & return token
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({
      token,
      userId:   user.userId,
      userType: user.userType
    });

  } catch (err) {
    next(err);
  }
});

// — All routes below require a valid JWT —
router.use(requireAuth);

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find()
      .select('-pwd')
      .populate('employee', 'empCd empName depotCd accessLevel')
      .populate('driver',   '_id');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Fetch one user
 */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-pwd')
      .populate('employee', 'empCd empName depotCd accessLevel')
      .populate('driver',   '_id');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId, userType, pwd, empCd, driverId } = req.body;
    let empDoc, drvDoc;

    if (['a','s'].includes(userType)) {
      if (!empCd) return res.status(400).json({ error: 'empCd required for admin/sales' });
      empDoc = await Employee.findOne({ empCd });
      if (!empDoc) return res.status(400).json({ error: `No employee for empCd=${empCd}` });
    }
    if (userType === 'd') {
      if (!driverId) return res.status(400).json({ error: 'driverId required for drivers' });
      drvDoc = await Driver.findById(driverId);
      if (!drvDoc) return res.status(400).json({ error: `No driver for id=${driverId}` });
    }

    const hash = await bcrypt.hash(pwd, 10);
    const newUser = await User.create({
      userId,
      userType,
      pwd:      hash,
      employee: empDoc?._id,
      driver:   drvDoc?._id
    });

    res.status(201).json({
      id:       newUser._id,
      userId:   newUser.userId,
      userType: newUser.userType,
      empCd:    empDoc?.empCd,
      driverId: drvDoc?._id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * Update a user
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.userId)   updates.userId   = req.body.userId;
    if (req.body.userType) updates.userType = req.body.userType;
    if (req.body.pwd)      updates.pwd      = await bcrypt.hash(req.body.pwd, 10);

    if (req.body.empCd) {
      const empDoc = await Employee.findOne({ empCd: req.body.empCd });
      if (!empDoc) return res.status(400).json({ error: `No employee for empCd=${req.body.empCd}` });
      updates.employee = empDoc._id;
    }
    if (req.body.driverId) {
      const drvDoc = await Driver.findById(req.body.driverId);
      if (!drvDoc) return res.status(400).json({ error: `No driver for id=${req.body.driverId}` });
      updates.driver = drvDoc._id;
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    )
      .select('-pwd')
      .populate('employee', 'empCd empName depotCd accessLevel')
      .populate('driver',   '_id');

    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:id
 * Remove a user
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
