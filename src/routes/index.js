const router = require('express').Router();

router.use('/employees', require('./employeeRoutes'));
router.use('/sheet', require('./sheetRoutes'));
router.use('/alerts', require('./alertRoutes'));

module.exports = router;
