// middleware/requireAdmin.js
const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  // 1) Grab and validate the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(400).json({ error: 'Malformed Authorization header' });
  }

  // 2) Verify JWT signature & extract payload
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 3) Ensure the userType is “A” (admin), case-insensitive
  if (payload.userType.toLowerCase() !== 'a') {
    return res.status(403).json({ error: 'Admins only' });
  }

  // 4) Attach the decoded payload to req.user and continue
  req.user = payload;
  next();
};
