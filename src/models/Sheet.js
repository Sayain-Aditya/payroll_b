const mongoose = require('mongoose');

const sheetSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    ctc: { type: Number, default: 0 },
    day: { type: Number, default: null },
    present: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    ew: { type: Number, default: 0 },
    cl: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    absentOverride: { type: Number, default: null }, // null = auto-derived on client
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sheetSchema.index({ employeeId: 1, month: 1 }, { unique: true });
sheetSchema.index({ month: 1, deletedAt: 1 });
sheetSchema.index({ employeeId: 1, deletedAt: 1 });

sheetSchema.set('toJSON', {
  virtuals: false,
  transform: (_, obj) => {
    obj.id = String(obj._id);
    obj.employeeId = String(obj.employeeId);
    delete obj._id;
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('Sheet', sheetSchema);
