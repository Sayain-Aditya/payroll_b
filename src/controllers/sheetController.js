const Employee = require('../models/Employee');
const Sheet = require('../models/Sheet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parseExcel } = require('../utils/parseExcel');
const { autoCl, daysInMonth } = require('../utils/calc');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const assertMonth = (m) => {
  if (!MONTH_RE.test(m || '')) throw new ApiError(400, 'month is required in YYYY-MM format');
};

// GET /api/sheet?month=YYYY-MM
exports.getSheet = asyncHandler(async (req, res) => {
  assertMonth(req.query.month);
  const rows = await Sheet.find({ month: req.query.month, deletedAt: null }, '-deletedAt -createdAt -updatedAt -__v').sort({ createdAt: 1 }).lean();
  const empIds = [...new Set(rows.map((r) => String(r.employeeId)))];
  const emps = await Employee.find({ _id: { $in: empIds } }, 'name designation dept place doj ctc company').lean();
  const empMap = Object.fromEntries(emps.map((e) => [String(e._id), e]));
  res.json({ rows: rows.map((r, i) => mergeRow(r, empMap[String(r.employeeId)], i + 1)) });
});

// POST /api/sheet/add   body: { month, employeeIds: [] }
exports.addToSheet = asyncHandler(async (req, res) => {
  const { month, employeeIds } = req.body;
  assertMonth(month);
  if (!Array.isArray(employeeIds) || !employeeIds.length) throw new ApiError(400, 'employeeIds array is required');

  const emps = await Employee.find({ _id: { $in: employeeIds } }).lean({ transform: false });
  const empMap = Object.fromEntries(emps.map((e) => [String(e._id), e]));

  const added = [];
  for (const eid of employeeIds) {
    const emp = empMap[eid];
    if (!emp) continue;
    const day = daysInMonth(month);
    const cl = autoCl(emp.doj, month);
    const present = day - cl;
    try {
      const row = await Sheet.create({ employeeId: eid, month, ctc: emp.ctc, day, present, leave: 0, ew: 0, cl, absent: 0 });
      added.push(mergeRow(row.toObject(), emp, 0));
    } catch (e) {
      if (e.code === 11000) {
        // Row exists but may be soft-deleted — restore it
        const restored = await Sheet.findOneAndUpdate(
          { employeeId: eid, month },
          { $set: { deletedAt: null, ctc: emp.ctc, day, present: day - cl, leave: 0, ew: 0, cl, absent: 0 } },
          { new: true }
        );
        if (restored) added.push(mergeRow(restored.toObject(), emp, 0));
        continue;
      }
      throw e;
    }
  }

  // re-fetch with correct srNo
  const allRows = await Sheet.find({ month, deletedAt: null }).sort({ createdAt: 1 }).lean({ transform: false });
  const allEmpIds = [...new Set(allRows.map((r) => String(r.employeeId)))];
  const allEmps = await Employee.find({ _id: { $in: allEmpIds } }).lean({ transform: false });
  const allEmpMap = Object.fromEntries(allEmps.map((e) => [String(e._id), e]));
  const addedIds = new Set(added.map((r) => r.id));
  const result = allRows
    .map((r, i) => mergeRow(r, allEmpMap[String(r.employeeId)], i + 1))
    .filter((r) => addedIds.has(r.id));

  res.status(201).json({ rows: result });
});

// PUT /api/sheet/:id
exports.updateRow = asyncHandler(async (req, res) => {
  const row = await Sheet.findById(req.params.id);
  if (!row) throw new ApiError(404, 'Row not found');

  const NUM_FIELDS = ['ctc', 'day', 'present', 'leave', 'ew', 'cl', 'absent', 'absentOverride'];
  for (const k of NUM_FIELDS) {
    if (!(k in req.body)) continue;
    const n = Number(req.body[k]);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${k} must be a non-negative number`);
    row[k] = n;
  }
  await row.save();

  const emp = await Employee.findById(row.employeeId).lean({ transform: false });
  res.json(mergeRow(row.toObject(), emp, null));
});

// DELETE /api/sheet/:id  (soft delete)
exports.deleteRow = asyncHandler(async (req, res) => {
  const row = await Sheet.findOneAndUpdate(
    { _id: req.params.id, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
  if (!row) throw new ApiError(404, 'Row not found');
  res.json({ ok: true });
});

// POST /api/sheet/import   multipart: file, month
exports.importExcel = asyncHandler(async (req, res) => {
  assertMonth(req.body.month);
  if (!req.file) throw new ApiError(400, 'Excel file is required (field name: file)');

  const { rows, warnings } = parseExcel(req.file.buffer, req.body.company || '');
  if (!rows.length) throw new ApiError(400, 'No employee rows found in the sheet');

  const month = req.body.month;

  // upsert all employees in parallel
  const empDocs = await Promise.all(rows.map((p) =>
    Employee.findOneAndUpdate(
      { name: p.name },
      { $set: { designation: p.designation || '', dept: p.dept || '', place: p.place || '', ...(p.company && { company: p.company }), ...(p.ctc != null && { ctc: p.ctc }), ...(p.doj && { doj: p.doj }), ...(p.bankName && { bankName: p.bankName }), ...(p.accountNo && { accountNo: p.accountNo }), ...(p.ifsc && { ifsc: p.ifsc }), deletedAt: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  ));

  // upsert all sheet rows in parallel
  let created = 0, updated = 0;
  await Promise.all(rows.map(async (p, i) => {
    const emp = empDocs[i];
    const day = p.day ?? daysInMonth(month);
    const cl = p.cl ?? autoCl(emp.doj, month);
    const present = p.present ?? day - cl;
    const leave = p.leave ?? 0;
    const ew = p.ew ?? 0;
    const absent = p.absent ?? Math.max(0, day - present - leave - cl);
    const ctc = p.ctc ?? emp.ctc;
    const result = await Sheet.findOneAndUpdate(
      { employeeId: emp._id, month },
      { $set: { ctc, day, present, leave, ew, cl, absent } },
      { upsert: true, new: true, includeResultMetadata: true }
    );
    result.lastErrorObject?.updatedExisting ? updated++ : created++;
  }));

  res.status(201).json({ total: rows.length, created, updated, warnings });
});

// ---- helper ----
function mergeRow(row, emp, srNo) {
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
    absentOverride: row.absentOverride ?? null,
    srNo,
    name: emp?.name ?? '',
    designation: emp?.designation ?? '',
    dept: emp?.dept ?? '',
    place: emp?.place ?? '',
    doj: emp?.doj ?? '',
    company: emp?.company ?? '',
  };
}
