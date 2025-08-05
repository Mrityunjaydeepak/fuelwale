// controllers/userController.js

const express     = require('express');
const router      = express.Router();
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');

const User        = require('../models/User');
const Employee    = require('../models/Employee');
const Driver      = require('../models/Driver');
const Customer    = require('../models/Customer');
const Trip        = require('../models/Trip');
const requireAuth = require('../middleware/requireAuth');

// ——— POST /api/users/login — authenticate & issue JWT ———
router.post('/login', async (req, res, next) => {
  try {
    const { userId, pwd } = req.body;
    if (!userId || !pwd) {
      return res.status(400).json({ error: 'userId and pwd are required' });
    }

    // 1) Find user and populate the appropriate ref
    const user = await User.findOne({ userId })
      .populate('employee', 'empCd accessLevel')
      .populate('driver',   '_id')
      .populate('customer', '_id');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2) Verify password
    const match = await bcrypt.compare(pwd, user.pwd);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3) If driver, ensure they have an assigned or active trip
    if (user.userType === 'D') {
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

    // 4) Build JWT payload
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
    if (user.customer) {
      payload.customerId  = user.customer._id;
    }

    // 5) Sign & return token
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({
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
 * List all users (no passwords)
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find()
      .select('-pwd')
      .populate('employee', 'empCd empName depotCd accessLevel')
      .populate('driver',   '_id')
      .populate('customer', 'custCd custName depotCd');
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
      .populate('driver',   '_id')
      .populate('customer', 'custCd custName depotCd');
    if (!user) return res.status(404).json({ error: 'User not found' });
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
    const {
      userId,
      userType,
      pwd,
      mobileNo,
      depotCd,
      empCd,
      driverId,
      customerId
    } = req.body;

    // Required core fields
    if (!userId || !userType || !pwd || !mobileNo || !depotCd) {
      return res.status(400).json({
        error: 'userId, userType, pwd, mobileNo and depotCd are required'
      });
    }

    let empDoc, drvDoc, custDoc;

    // validate references based on type
    if (userType === 'E') {
      if (!empCd) {
        return res.status(400).json({ error: 'empCd required for Employee users' });
      }
      empDoc = await Employee.findOne({ empCd });
      if (!empDoc) {
        return res.status(400).json({ error: `No employee found for empCd=${empCd}` });
      }
    }

    if (userType === 'D') {
      if (!driverId) {
        return res.status(400).json({ error: 'driverId required for Driver users' });
      }
      drvDoc = await Driver.findById(driverId);
      if (!drvDoc) {
        return res.status(400).json({ error: `No driver found for id=${driverId}` });
      }
    }

    if (userType === 'C') {
      if (!customerId) {
        return res.status(400).json({ error: 'customerId required for Customer users' });
      }
      custDoc = await Customer.findById(customerId);
      if (!custDoc) {
        return res.status(400).json({ error: `No customer found for id=${customerId}` });
      }
    }

    // hash password and create
    const hash = await bcrypt.hash(pwd, 10);
    const newUser = await User.create({
      userId,
      userType,
      pwd:        hash,
      mobileNo,
      depotCd,
      employee:   empDoc?._id,
      driver:     drvDoc?._id,
      customer:   custDoc?._id
    });

    res.status(201).json({
      id:         newUser._id,
      userId:     newUser.userId,
      userType:   newUser.userType,
      mobileNo:   newUser.mobileNo,
      depotCd:    newUser.depotCd,
      empCd:      empDoc?.empCd,
      driverId:   drvDoc?._id,
      customerId: custDoc?._id
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
    const {
      userId,
      userType,
      pwd,
      mobileNo,
      depotCd,
      empCd,
      driverId,
      customerId
    } = req.body;

    if (userId)   updates.userId   = userId;
    if (userType) updates.userType = userType;
    if (mobileNo) updates.mobileNo = mobileNo;
    if (depotCd)  updates.depotCd  = depotCd;
    if (pwd) {
      updates.pwd = await bcrypt.hash(pwd, 10);
    }

    if (empCd) {
      const empDoc = await Employee.findOne({ empCd });
      if (!empDoc) {
        return res.status(400).json({ error: `No employee found for empCd=${empCd}` });
      }
      updates.employee = empDoc._id;
    }

    if (driverId) {
      const drvDoc = await Driver.findById(driverId);
      if (!drvDoc) {
        return res.status(400).json({ error: `No driver found for id=${driverId}` });
      }
      updates.driver = drvDoc._id;
    }

    if (customerId) {
      const custDoc = await Customer.findById(customerId);
      if (!custDoc) {
        return res.status(400).json({ error: `No customer found for id=${customerId}` });
      }
      updates.customer = custDoc._id;
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )
      .select('-pwd')
      .populate('employee', 'empCd empName depotCd accessLevel')
      .populate('driver',   '_id')
      .populate('customer', 'custCd custName depotCd');

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

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
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
