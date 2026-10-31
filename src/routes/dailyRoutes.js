const router = require('express').Router();
const c = require('../controllers/dailyAttendanceController');

router.get('/employee/:id', c.getEmployeeCalendar);
router.post('/sync', c.syncMonth);
router.get('/', c.getDaily);
router.post('/', c.saveDaily);

module.exports = router;
