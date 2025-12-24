// middleware/requireDepotScope.js
/**
 * Enforces: non-admin users can only access resources for their own depot.
 *
 * Usage patterns:
 * 1) Route has depotCd in params:
 *    router.get('/depots/:depotCd/customers', requireDepotScope({ source: 'params', key: 'depotCd' }), handler)
 *
 * 2) Route has depotCd in body:
 *    router.post('/customers', requireDepotScope({ source: 'body', key: 'depotCd' }), handler)
 *
 * 3) Route has no depotCd at all (common):
 *    Use requireDepotScope() to simply guarantee req.user.depotCd exists,
 *    then in queries always filter by req.user.depotCd.
 */
module.exports = function requireDepotScope(options = {}) {
  const {
    source = null,        // 'params' | 'body' | 'query' | null
    key = 'depotCd',      // name of field to read from that source
    adminBypass = true,   // admins can cross depots
    allowMissing = true   // if true and source/key not present, just pass through
  } = options;

  return (req, res, next) => {
    // must have depotCd on the authenticated user
    if (!req.user || !req.user.depotCd) {
      return res.status(401).json({ error: 'Unauthorized: depot missing on user context' });
    }

    // allow admins to access any depot if desired
    if (adminBypass && req.user.isAdmin) {
      return next();
    }

    // if no source specified, nothing to compare; caller should filter queries by req.user.depotCd
    if (!source) return next();

    const container =
      source === 'params' ? req.params :
      source === 'body'   ? req.body   :
      source === 'query'  ? req.query  :
      null;

    if (!container) {
      return res.status(500).json({ error: 'Server misconfigured: invalid depot scope source' });
    }

    const requested = container?.[key];

    // if depotCd is not provided in request, allow through (typical list endpoints)
    if (requested == null || requested === '') {
      return allowMissing
        ? next()
        : res.status(400).json({ error: `Missing ${key}` });
    }

    if (String(requested).trim() !== String(req.user.depotCd).trim()) {
      return res.status(403).json({ error: 'Forbidden: depot mismatch' });
    }

    return next();
  };
};
