const router = require('express').Router();

router.use('/employees', require('./employeeRoutes'));
router.use('/sheet', require('./sheetRoutes'));
router.use('/alerts', require('./alertRoutes'));
router.use('/holidays', require('./holidayRoutes'));
router.use('/daily', require('./dailyRoutes'));

module.exports = router;
