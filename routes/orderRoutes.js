const express = require('express');
const router = express.Router();
const controller = require('../controllers/routeController');

// GET /api/routes
router.get('/', controller.getAll);

// GET /api/routes/:id
router.get('/:id', controller.getById);

// POST /api/routes
router.post('/', controller.create);

// PUT /api/routes/:id
router.put('/:id', controller.update);

// DELETE /api/routes/:id
router.delete('/:id', controller.remove);

module.exports = router;
