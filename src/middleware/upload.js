const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Only .xlsx or .xls files are allowed')),
});
