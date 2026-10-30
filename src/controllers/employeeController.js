const Employee = require('../models/Employee');
const Sheet = require('../models/Sheet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/employees
exports.listEmployees = asyncHandler(async (req, res) => {
  const filter = { deletedAt: null, ...(req.query.dept ? { dept: req.query.dept } : {}) };
  const data = await Employee.find(filter).sort({ name: 1 }).lean({ transform: false });
  res.json({ data: data.map(toEmp) });
});

// POST /api/employees
exports.createEmployee = asyncHandler(async (req, res) => {
  const { name, designation = '', dept = '', place = '', ctc = 0, doj = '', bankName = '', accountNo = '', ifsc = '' } = req.body;
  if (!String(name || '').trim()) throw new ApiError(400, 'Name is required');
  const existing = await Employee.findOne({ name: name.trim() });
  if (existing && existing.deletedAt) {
    existing.set({ designation, dept, place, ctc: Number(ctc) || 0, doj, bankName, accountNo, ifsc, deletedAt: null });
    await existing.save();
    return res.status(201).json(toEmp(existing.toJSON()));
  }
  const emp = await Employee.create({ name: name.trim(), designation, dept, place, ctc: Number(ctc) || 0, doj, bankName, accountNo, ifsc });
  res.status(201).json(toEmp(emp.toJSON()));
});

// PUT /api/employees/:id
exports.updateEmployee = asyncHandler(async (req, res) => {
  const allowed = ['name', 'designation', 'dept', 'place', 'ctc', 'doj', 'bankName', 'accountNo', 'ifsc'];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  if (update.ctc != null) update.ctc = Number(update.ctc) || 0;
  const emp = await Employee.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
  if (!emp) throw new ApiError(404, 'Employee not found');
  res.json(toEmp(emp.toJSON()));
});

// DELETE /api/employees/:id  (soft delete)
exports.deleteEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );
  if (!emp) throw new ApiError(404, 'Employee not found');
  // Soft-delete all sheet rows for this employee too
  await Sheet.updateMany({ employeeId: req.params.id, deletedAt: null }, { $set: { deletedAt: new Date() } });
  res.json({ ok: true });
});

// POST /api/employees/:id/restore
exports.restoreEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findOneAndUpdate(
    { _id: req.params.id, deletedAt: { $ne: null } },
    { $set: { deletedAt: null } },
    { new: true }
  );
  if (!emp) throw new ApiError(404, 'Deleted employee not found');
  await Sheet.updateMany({ employeeId: req.params.id }, { $set: { deletedAt: null } });
  res.json(toEmp(emp.toJSON()));
});

// GET /api/employees/:id/history
exports.getHistory = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id).lean({ transform: false });
  if (!emp) throw new ApiError(404, 'Employee not found');
  const rows = await Sheet.find({ employeeId: req.params.id, deletedAt: null }).sort({ month: -1 }).lean({ transform: false });
  res.json({ rows: rows.map((r) => mergeEmp(r, emp)) });
});

// ---- helpers ----
function toEmp(e) {
  return {
    id: String(e._id || e.id),
    name: e.name, designation: e.designation, dept: e.dept,
    place: e.place, ctc: e.ctc, doj: e.doj,
    bankName: e.bankName || '', accountNo: e.accountNo || '', ifsc: e.ifsc || '',
  };
}

function mergeEmp(row, emp) {
  return {
    id: String(row._id),
    employeeId: String(row.employeeId),
    month: row.month,
    ctc: row.ctc,
    day: row.day,
    present: row.present,
    leave: row.leave,
    ew: row.ew,
    cl: row.cl,
    absent: row.absent,
    name: emp.name,
    designation: emp.designation,
    dept: emp.dept,
    place: emp.place,
    doj: emp.doj,
    bankName: emp.bankName || '', accountNo: emp.accountNo || '', ifsc: emp.ifsc || '',
  };
}
