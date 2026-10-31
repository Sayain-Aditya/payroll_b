const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const routes = require('./routes');
const authRoutes = require('./routes/authRoutes');
const auth = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// ensure DB is connected before every request (safe for serverless)
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(500).json({ error: 'Database connection failed' }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api', auth, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
