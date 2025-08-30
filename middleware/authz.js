// middleware/authz.js
// Assumes you've already authenticated (e.g., JWT) and set req.user to a User doc.

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    if (req.user.hasRole('ADMIN')) return next(); // admins bypass
    if (!req.user.hasRole(...roles)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { requireRoles };
