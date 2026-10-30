const router = require('express').Router();

router.use('/employees', require('./employeeRoutes'));
router.use('/sheet', require('./sheetRoutes'));

module.exports = router;
