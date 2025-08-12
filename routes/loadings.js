// routes/loadings.js
const express = require('express');
const router = express.Router();
const Route = require('../models/Route');
const LoadingSource = require('../models/LoadingSource');

/**
 * GET /loadings/stations/:routeId
 * Returns stations bound to the route, shaped for the frontend:
 *   [{ _id, name }]
 */
router.get('/stations/:routeId', async (req, res, next) => {
  try {
    const { routeId } = req.params;
    const route = await Route.findById(routeId).lean();

    if (!route) return res.status(404).json({ error: 'Route not found' });

    // If a route has no stationIds configured, you can choose to return [] or all stations.
    const query = Array.isArray(route.stationIds) && route.stationIds.length
      ? { _id: { $in: route.stationIds } }
      : {}; // fallback: return all LoadingSources

    const sources = await LoadingSource.find(query)
      .select('_id name')   // your model uses `name`
      .sort({ name: 1 })
      .lean();

    const stations = sources.map(s => ({ _id: s._id, name: s.name }));
    res.json(stations);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
