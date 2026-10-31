const router = require('express').Router();
const c = require('../controllers/holidayController');

router.get('/', c.list);
router.post('/', c.create);
router.delete('/:id', c.remove);
router.post('/apply', c.apply);

module.exports = router;
