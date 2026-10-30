const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const authRoutes = require('./routes/authRoutes');
const auth = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api', auth, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
