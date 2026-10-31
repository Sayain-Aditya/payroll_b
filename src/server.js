require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// For Vercel serverless — connect on every cold start and reuse
let connected = false;
app.use(async (req, res, next) => {
  if (!connected) {
    await connectDB();
    connected = true;
  }
  next();
});

// For local dev
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => app.listen(PORT, () => console.log(`API running on port ${PORT}`)));
}

// For Vercel serverless
module.exports = app;
