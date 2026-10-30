const router = require('express').Router();
const c = require('../controllers/employeeController');

router.get('/', c.listEmployees);
router.post('/', c.createEmployee);
router.put('/:id', c.updateEmployee);
router.delete('/:id', c.deleteEmployee);
router.post('/:id/restore', c.restoreEmployee);
router.get('/:id/history', c.getHistory);

module.exports = router;
