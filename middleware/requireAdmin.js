// middleware/requireAdmin.js
const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'Missing token' });

  let payload;
  try {
    payload = jwt.verify(auth, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (payload.userType !== 'A') {
    return res.status(403).json({ error: 'Admins only' });
  }

  // attach user to req if you need it later
  req.user = payload;
  next();
};
