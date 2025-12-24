// routes/_debugAuth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

router.get('/auth', (req, res) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  const secret = process.env.JWT_SECRET || '';
  const secretFingerprint = crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex')
    .slice(0, 12);

  if (scheme !== 'Bearer' || !token) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_OR_MALFORMED_AUTH_HEADER',
      gotAuthorizationHeader: header || null,
      secretPresent: !!process.env.JWT_SECRET,
      secretFingerprint
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({
      ok: true,
      payload,
      secretPresent: !!process.env.JWT_SECRET,
      secretFingerprint
    });
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: 'JWT_VERIFY_FAILED',
      name: err.name,
      message: err.message,
      secretPresent: !!process.env.JWT_SECRET,
      secretFingerprint
    });
  }
});

module.exports = router;
