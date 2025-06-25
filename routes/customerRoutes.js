const express      = require('express');
const router       = express.Router();
const requireAuth  = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const ctrl         = require('../controllers/customerController');

router.use(requireAuth);

router.get('/',        ctrl.listCustomers);
router.get('/:id',     ctrl.getCustomer);
router.post('/',       requireAdmin, ctrl.createCustomer);
router.put('/:id',     requireAdmin, ctrl.updateCustomer);
router.delete('/:id',  requireAdmin, ctrl.deleteCustomer);

module.exports = router;
