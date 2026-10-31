require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// For local dev
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`API running on port ${PORT}`)))
    .catch((err) => { console.error(err.message); process.exit(1); });
}

// For Vercel serverless
module.exports = app;
