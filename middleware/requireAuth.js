// middleware/requireAuth.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const [ scheme, token ] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(400).json({ error: 'Malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.id)
      .populate('employee', 'empCd accessLevel roles');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userTypeStr    = String(user.userType || '').toLowerCase();
    const accessLevelStr = String(user.employee?.accessLevel || '').toLowerCase();
    const rolesArr       = Array.isArray(user.roles)
      ? user.roles
      : (Array.isArray(user.employee?.roles) ? user.employee.roles : []);
    const rolesLower     = rolesArr.map(r => String(r).toLowerCase());

    const isAdmin =
      ['admin', 'superadmin', 'owner', 'root', 'system'].includes(userTypeStr) ||
      ['admin', 'superadmin', 'owner', 'root', 'system'].includes(accessLevelStr) ||
      rolesLower.includes('admin') ||
      rolesLower.includes('superadmin');

    req.user = {
      id:          user._id,
      userType:    user.userType,
      empCd:       user.employee?.empCd,       // may be undefined for admins
      accessLevel: user.employee?.accessLevel,
      roles:       rolesArr,
      isAdmin
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
