const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseExcel } = require('../utils/parseExcel');
const { calculateAttendance } = require('../utils/calculateAttendance');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const assertMonth = (m) => {
  if (!MONTH_RE.test(m || '')) throw new ApiError(400, 'month is required in YYYY-MM format');
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/attendance/upload   (multipart: file, month)
exports.uploadAttendance = asyncHandler(async (req, res) => {
  const { month } = req.body;
  assertMonth(month);
  if (!req.file) throw new ApiError(400, 'Excel file is required (field name: file)');

  const { rows, warnings } = parseExcel(req.file.buffer);
  if (!rows.length) throw new ApiError(400, 'No employee rows found in the sheet');

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const employee = await Employee.findOneAndUpdate(
      { name: r.name },
      { $set: { place: r.place, designation: r.designation, dept: r.dept, ctc: r.ctc, doj: r.doj } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const inputs = { day: r.day, present: r.present, leave: r.leave, ew: r.ew, absentInput: r.absentInput };
    const computed = calculateAttendance({ ...inputs, doj: employee.doj }, month);

    const result = await Attendance.findOneAndUpdate(
      { employee: employee._id, month },
      { $set: { srNo: r.srNo, ...inputs, ...computed } },
      { upsert: true, new: true, includeResultMetadata: true }
    );
    result.lastErrorObject?.updatedExisting ? updated++ : created++;
  }

  res.status(201).json({ month, total: rows.length, created, updated, warnings });
});

// GET /api/attendance?month=YYYY-MM&dept=Sales&search=ravi
exports.getAttendance = asyncHandler(async (req, res) => {
  const { month, dept, search } = req.query;
  const filter = {};

  if (month) { assertMonth(month); filter.month = month; }
  if (dept || search) {
    const ef = {};
    if (dept) ef.dept = dept;
    if (search) ef.name = new RegExp(escapeRegex(search), 'i');
    filter.employee = { $in: await Employee.find(ef).distinct('_id') };
  }

  const data = await Attendance.find(filter).populate('employee').sort({ srNo: 1, createdAt: 1 }).lean();
  res.json({ count: data.length, data });
});

// GET /api/attendance/summary?month=YYYY-MM  -> totals per department
exports.getSummary = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const match = {};
  if (month) { assertMonth(month); match.month = month; }

  const departments = await Attendance.aggregate([
    { $match: match },
    { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
    { $unwind: '$emp' },
    {
      $group: {
        _id: '$emp.dept',
        employees: { $sum: 1 },
        present: { $sum: '$present' },
        leave: { $sum: '$leave' },
        extraWorking: { $sum: '$ew' },
        cl: { $sum: '$cl' },
        absent: { $sum: '$absent' },
        dayDeduction: { $sum: '$dayDeduction' },
        totalWorking: { $sum: '$totalWorking' },
        totalAttendance: { $sum: '$totalAttendance' },
      },
    },
    { $project: { _id: 0, dept: '$_id', employees: 1, present: 1, leave: 1, extraWorking: 1, cl: 1, absent: 1, dayDeduction: 1, totalWorking: 1, totalAttendance: 1 } },
    { $sort: { dept: 1 } },
  ]);

  const totals = departments.reduce((t, d) => {
    for (const k of Object.keys(d)) if (k !== 'dept') t[k] = (t[k] || 0) + d[k];
    return t;
  }, {});

  res.json({ month: month || null, departments, totals });
});

// GET /api/attendance/:id
exports.getAttendanceById = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id).populate('employee');
  if (!record) throw new ApiError(404, 'Attendance record not found');
  res.json(record);
});

// PUT /api/attendance/:id   body: { present, leave, ew, day, absentInput }
exports.updateAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id).populate('employee');
  if (!record) throw new ApiError(404, 'Attendance record not found');

  for (const key of ['day', 'present', 'leave', 'ew', 'absentInput']) {
    if (!(key in req.body)) continue;
    const v = req.body[key];
    if ((key === 'absentInput' || key === 'day') && (v === null || v === '')) {
      record[key] = null; // back to auto
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${key} must be a non-negative number`);
    record[key] = n;
  }

  Object.assign(record, calculateAttendance({ ...record.toObject(), doj: record.employee.doj }, record.month));
  await record.save();
  res.json(record);
});

// DELETE /api/attendance/:id
exports.deleteAttendance = asyncHandler(async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) throw new ApiError(404, 'Attendance record not found');
  res.json({ message: 'Deleted' });
});

// DELETE /api/attendance?month=YYYY-MM   (remove a whole month, e.g. a wrong upload)
exports.deleteMonth = asyncHandler(async (req, res) => {
  assertMonth(req.query.month);
  const { deletedCount } = await Attendance.deleteMany({ month: req.query.month });
  res.json({ month: req.query.month, deletedCount });
});
