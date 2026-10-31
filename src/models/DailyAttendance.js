const mongoose = require('mongoose');

const dailySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/ }, // YYYY-MM-DD
    status: { type: String, enum: ['present', 'absent', 'leave', 'halfday'], required: true },
  },
  { timestamps: true }
);

dailySchema.index({ employee: 1, date: 1 }, { unique: true });
dailySchema.index({ date: 1 });

module.exports = mongoose.model('DailyAttendance', dailySchema);
