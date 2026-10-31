const mongoose = require('mongoose');

module.exports = async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  if (mongoose.connection.readyState >= 1) return; // already connected or connecting
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  console.log('MongoDB connected');
};
