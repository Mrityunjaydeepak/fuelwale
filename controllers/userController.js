// controllers/userController.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const list = await User.find().select('-pwd'); // omit pwd
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/login
router.post('/login', async (req, res, next) => {
  try {
    const { userId, pwd } = req.body;
    if (!userId || !pwd) {
      return res.status(400).json({ error: 'userId and pwd are required' });
    }

    // 1) Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2) Check password
    const match = await bcrypt.compare(pwd, user.pwd);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3) Sign a JWT
    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 4) Return token and basic user info
    return res.json({
      token,
      userId:   user.userId,
      userType: user.userType
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const item = await User.findById(req.params.id).select('-pwd');
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  try {
    // Hash the password before creating
    const hash = await bcrypt.hash(req.body.pwd, 10);
    const newUser = await User.create({ 
      userId:   req.body.userId,
      userType: req.body.userType,
      pwd:      hash
    });
    res.status(201).json({ 
      id:       newUser._id,
      userId:   newUser.userId,
      userType: newUser.userType
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res, next) => {
  try {
    // If updating password, hash it
    if (req.body.pwd) {
      req.body.pwd = await bcrypt.hash(req.body.pwd, 10);
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).select('-pwd');
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
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
