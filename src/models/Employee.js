const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    designation: { type: String, trim: true, default: '' },
    dept: { type: String, trim: true, default: '' },
    place: { type: String, trim: true, default: '' },
    ctc: { type: Number, default: 0 },
    doj: { type: String, default: '' },
    bankName: { type: String, trim: true, default: '' },
    accountNo: { type: String, trim: true, default: '' },
    ifsc: { type: String, trim: true, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Expose _id as "id" string in JSON
employeeSchema.set('toJSON', {
  virtuals: false,
  transform: (_, obj) => {
    obj.id = String(obj._id);
    delete obj._id;
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('Employee', employeeSchema);
