const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
  name: { type: String, required: true, trim: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // YYYY-MM derived
}, { timestamps: true });

holidaySchema.index({ month: 1 });
holidaySchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
