// controllers/userController.js

const express     = require('express');
const router      = express.Router();
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');
const axios       = require('axios');

const User        = require('../models/User');
const Employee    = require('../models/Employee');
const Driver      = require('../models/Driver');
const Customer    = require('../models/Customer');
const Trip        = require('../models/Trip');
const requireAuth = require('../middleware/requireAuth');

/** -------------------- Pearl SMS config -------------------- **/
const PEARL_SMS_BASE_URL = process.env.PEARL_SMS_BASE_URL || 'http://sms.pearlsms.com/public/sms/send';
const PEARL_SMS_API_KEY  = process.env.PEARL_SMS_API_KEY; // required
const PEARL_SMS_SENDER   = (process.env.PEARL_SMS_SENDER || 'FUELWL').toUpperCase(); // must be 6 alphabetic chars
const PEARL_SMS_TYPE     = process.env.PEARL_SMS_TYPE || 'TRANS'; // TRANS or PROMO
const APP_NAME           = process.env.APP_NAME || 'Fuelwale'; // not used in template, but kept for compatibility

/** -------------------- OTP in-memory store -------------------- **
 * Note: For production, back this with Redis or a Mongo collection.
 * This in-memory store will reset on process restart and doesn't scale horizontally.
 */
const OTP_TTL_MS          = 5 * 60 * 1000;   // 5 minutes
const RESEND_WINDOW_MS    = 45 * 1000;       // min gap between sends
const MAX_SENDS_PER_HOUR  = 5;
const MAX_VERIFY_ATTEMPTS = 6;

const otpStore = new Map(); // key: user._id.toString(), value: { otpHash, expiresAt, lastSentAt, sendCountWindowStart, sendCount, verifyAttempts }

/** Utility: generate 6-digit numeric OTP */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Utility: send SMS via Pearl */
async function sendPearlSms({ to, message }) {
  if (!PEARL_SMS_API_KEY) {
    const err = new Error('PEARL_SMS_API_KEY not configured');
    err.status = 500;
    throw err;
  }
  if (!/^[A-Z]{6}$/.test(PEARL_SMS_SENDER)) {
    const err = new Error('PEARL_SMS_SENDER must be 6 alphabetic characters (A-Z)');
    err.status = 500;
    throw err;
  }
  const params = {
    sender:   PEARL_SMS_SENDER,
    smstype:  PEARL_SMS_TYPE,
    numbers:  to,
    apikey:   PEARL_SMS_API_KEY,
    message:  message,
    unicode:  'no' // English message; set 'yes' if using non-English content
  };

  // Pearl supports GET or POST; using GET per docs
  const res = await axios.get(PEARL_SMS_BASE_URL, { params, timeout: 12000 });
  return res.data;
}

/** -------------------- NEW: OTP Login APIs -------------------- **/

// ——— POST /api/users/login/otp/request — send OTP via SMS ———
// Body: { userId?: string, mobileNo?: string }
router.post('/login/otp/request', async (req, res, next) => {
  try {
    const { userId, mobileNo } = req.body || {};
    if (!userId && !mobileNo) {
      return res.status(400).json({ error: 'Provide userId or mobileNo' });
    }

    // Look up user by userId or mobileNo
    const userQuery = userId ? { userId } : { mobileNo };
    const user = await User.findOne(userQuery).populate('driver', '_id');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.mobileNo) {
      return res.status(400).json({ error: 'User has no mobile number on record' });
    }

    const key = String(user._id);
    const now = Date.now();
    let entry = otpStore.get(key);

    // throttle: min gap between sends
    if (entry && entry.lastSentAt && now - entry.lastSentAt < RESEND_WINDOW_MS) {
      const retryIn = Math.ceil((RESEND_WINDOW_MS - (now - entry.lastSentAt)) / 1000);
      return res.status(429).json({ error: `OTP sent recently. Try again in ${retryIn}s.` });
    }

    // rate limit: max sends per hour
    if (!entry) {
      entry = {
        otpHash: null,
        expiresAt: 0,
        lastSentAt: 0,
        sendCountWindowStart: now,
        sendCount: 0,
        verifyAttempts: 0
      };
    }
    // reset hourly window if older than 1 hour
    if (now - entry.sendCountWindowStart >= 60 * 60 * 1000) {
      entry.sendCountWindowStart = now;
      entry.sendCount = 0;
    }
    if (entry.sendCount >= MAX_SENDS_PER_HOUR) {
      return res.status(429).json({ error: 'Too many OTP requests. Try again later.' });
    }

    // generate & hash OTP
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 8);
    entry.otpHash = otpHash;
    entry.expiresAt = now + OTP_TTL_MS;
    entry.lastSentAt = now;
    entry.sendCount += 1;
    entry.verifyAttempts = 0;
    otpStore.set(key, entry);

    // *** GOVT-APPROVED TEMPLATE (DLT): DO NOT CHANGE TEXT ***
    const smsText = `Your OTP is ${otp}. Use this to verify your mobile number on SPPLFW. Valid for 5 minutes.`;

    // Fire SMS
    await sendPearlSms({ to: user.mobileNo, message: smsText });

    // For development, you may expose OTP. Avoid returning the OTP in production.
    const includeOtp = process.env.NODE_ENV !== 'production';

    res.json({
      message: 'OTP sent successfully',
      sentTo: user.mobileNo,
      ...(includeOtp ? { debugOtp: otp } : {})
    });
  } catch (err) {
    next(err);
  }
});

// ——— POST /api/users/login/otp/verify — verify OTP + issue JWT ———
// Body: { userId?: string, mobileNo?: string, otp: string }
router.post('/login/otp/verify', async (req, res, next) => {
  try {
    const { userId, mobileNo, otp } = req.body || {};
    if ((!userId && !mobileNo) || !otp) {
      return res.status(400).json({ error: 'Provide otp and userId or mobileNo' });
    }

    // Fetch user
    const userQuery = userId ? { userId } : { mobileNo };
    const user = await User.findOne(userQuery)
      .populate('employee', 'empCd accessLevel')
      .populate('driver',   '_id')
      .populate('customer', '_id');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const key = String(user._id);
    const entry = otpStore.get(key);
    const now = Date.now();

    if (!entry || !entry.otpHash) {
      return res.status(400).json({ error: 'No active OTP. Please request a new one.' });
    }
    if (now > entry.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }
    if (entry.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(key);
      return res.status(429).json({ error: 'Too many invalid attempts. Please request a new OTP.' });
    }

    const ok = await bcrypt.compare(String(otp), entry.otpHash);
    if (!ok) {
      entry.verifyAttempts += 1;
      otpStore.set(key, entry);
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // OTP is valid — consume it
    otpStore.delete(key);

    // If driver, ensure they have an assigned or active trip (same as password flow)
    if (user.userType === 'D') {
      const hasTrip = await Trip.findOne({
        driverId: user.driver?._id,
        status: { $in: ['ASSIGNED', 'ACTIVE'] }
      });
      if (!hasTrip) {
        return res
          .status(403)
          .json({ error: 'No trips assigned to you. Please check back later.' });
      }
    }

    // Build JWT payload (mirrors your /login)
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

/** -------------------- EXISTING: Password Login -------------------- **/

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
