const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "YYYY-MM"
    srNo: { type: Number, default: null },

    // ---- inputs (from the Excel / manual edit) ----
    day: { type: Number, default: null },          // days in month
    present: { type: Number, default: 0, min: 0 },
    leave: { type: Number, default: 0, min: 0 },
    ew: { type: Number, default: 0, min: 0 },      // extra working days
    absentInput: { type: Number, default: null },  // absent given in Excel (null = auto)

    // ---- calculated by the server ----
    cl: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    totalWorking: { type: Number, default: 0 },
    dayDeduction: { type: Number, default: 0 },
    totalAttendance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// one record per employee per month
attendanceSchema.index({ employee: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
