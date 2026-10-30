const router = require('express').Router();
const upload = require('../middleware/upload');
const c = require('../controllers/sheetController');

router.get('/', c.getSheet);
router.post('/add', c.addToSheet);
router.post('/import', upload.single('file'), c.importExcel);
router.put('/:id', c.updateRow);
router.delete('/:id', c.deleteRow);

module.exports = router;
