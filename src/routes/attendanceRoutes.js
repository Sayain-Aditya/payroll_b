const router = require('express').Router();
const upload = require('../middleware/upload');
const c = require('../controllers/attendanceController');

router.post('/upload', upload.single('file'), c.uploadAttendance);
router.get('/summary', c.getSummary); // keep above '/:id'
router.get('/', c.getAttendance);
router.delete('/', c.deleteMonth);
router.get('/:id', c.getAttendanceById);
router.put('/:id', c.updateAttendance);
router.delete('/:id', c.deleteAttendance);

module.exports = router;
