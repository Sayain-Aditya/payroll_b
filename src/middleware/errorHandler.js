const multer = require('multer');

exports.notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err instanceof multer.MulterError) status = 400;
  if (err.name === 'CastError') { status = 400; message = 'Invalid id'; }
  if (err.name === 'ValidationError') status = 400;
  if (err.code === 11000) { status = 409; message = 'Duplicate record'; }

  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
};
