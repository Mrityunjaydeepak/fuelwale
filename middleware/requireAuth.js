// middleware/requireAuth.js

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function requireAuth(req, res, next) {
  // 1) Check for token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const [ scheme, token ] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(400).json({ error: 'Malformed Authorization header' });
  }

  try {
    // 2) Verify token signature & expiry
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Fetch the full User (and its linked Employee)
    const user = await User.findById(payload.id)
      .populate('employee', 'empCd accessLevel');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 4) Attach only the bits we need to req.user
    req.user = {
      id:          user._id,
      userType:    user.userType,
      empCd:       user.employee?.empCd,       // undefined if not linked
      accessLevel: user.employee?.accessLevel  // undefined if not linked
    };

    next();
  } catch (err) {
    // Token expired or signature invalid
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
