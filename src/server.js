require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Connect to DB (serverless: reuse connection across invocations)
connectDB().catch((err) => console.error('DB connection error:', err.message));

// For local dev
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

// For Vercel serverless
module.exports = app;
