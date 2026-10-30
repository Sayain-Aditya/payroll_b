const mongoose = require('mongoose');

module.exports = async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  // reuse existing connection in serverless environments
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
};
