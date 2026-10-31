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
    absentOverride: { type: Number, default: null },
    holiday: { type: Number, default: 0 },
    manualOverride: { type: Boolean, default: false },
    remark: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sheetSchema.index({ employeeId: 1 }, { unique: true });
sheetSchema.index({ deletedAt: 1 });

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

// Returns a Mongoose model whose documents live in collection "sheet_YYYY_MM"
// e.g. month "2026-09" → collection "sheet_2026_09"
function getSheetModel(month) {
  const collectionName = `sheet_${month.replace('-', '_')}`;
  // reuse existing model if already registered to avoid OverwriteModelError
  if (mongoose.modelNames().includes(collectionName)) {
    return mongoose.model(collectionName);
  }
  return mongoose.model(collectionName, sheetSchema, collectionName);
}

module.exports = { getSheetModel };
