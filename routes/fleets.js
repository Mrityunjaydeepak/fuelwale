// routes/fleets.js
const express = require('express');
const router = express.Router();
const fleets = require('../controllers/fleetsController');

// log every request that hits THIS router
router.use((req, _res, next) => {
  console.log(`[fleets-router] ${req.method} ${req.originalUrl}`);
  next();
});

// list/search fleets
router.get('/', fleets.list);

// driver maintenance on a fleet
router.put('/assign-driver', fleets.assignDriver);
router.put('/release-driver', fleets.releaseDriver);

// allocate / release fleet to/from an order (preferred :id form)
router.put('/:id/allocate', fleets.allocateToOrder);
router.put('/:id/release', fleets.releaseFromOrder);

// body-style fallbacks (so /fleets/allocate also works)


router.post('/sync-from-vehicles', fleets.syncFromVehicles);

module.exports = router;
