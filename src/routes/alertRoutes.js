const router = require('express').Router();
const { getAlerts } = require('../controllers/alertController');

router.get('/', getAlerts);

module.exports = router;
