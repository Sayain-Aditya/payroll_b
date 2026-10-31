const mongoose = require('mongoose');
const DailyAttendance = require('../models/DailyAttendance');
const Employee = require('../models/Employee');
const { getSheetModel } = require('../models/Sheet');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { autoCl, daysInMonth } = require('../utils/calc');

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const assertDate = (d) => {
  if (!DATE_RE.test(d || '')) throw new ApiError(400, 'date is required in YYYY-MM-DD format');
};

// GET /api/daily?date=YYYY-MM-DD&dept=&company=
exports.getDaily = asyncHandler(async (req, res) => {
  const { date, dept, company } = req.query;
  assertDate(date);

  const empFilter = { deletedAt: null };
  if (dept) empFilter.dept = dept;
  if (company) empFilter.company = company;

  const [employees, records] = await Promise.all([
    Employee.find(empFilter).sort({ name: 1 }).lean(),
    DailyAttendance.find({ date }).lean(),
  ]);

  const map = Object.fromEntries(records.map((r) => [String(r.employee), r.status]));

  const data = employees.map((e) => ({
    employeeId: String(e._id),
    name: e.name,
    designation: e.designation,
    dept: e.dept,
    company: e.company,
    status: map[String(e._id)] || null,
  }));

  res.json({ date, count: data.length, data });
});

// POST /api/daily   body: { date, records: [{ employeeId, status }] }
exports.saveDaily = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  assertDate(date);
  if (!Array.isArray(records) || !records.length) throw new ApiError(400, 'records array is required');

  const VALID = ['present', 'absent', 'leave', 'halfday', 'holiday'];
  const ops = records.map(({ employeeId, status }) => {
    if (!employeeId) throw new ApiError(400, 'employeeId is required in each record');
    if (!VALID.includes(status)) throw new ApiError(400, `Invalid status "${status}"`);
    return {
      updateOne: {
        filter: { employee: new mongoose.Types.ObjectId(employeeId), date },
        update: { $set: { status } },
        upsert: true,
      },
    };
  });

  await DailyAttendance.bulkWrite(ops);

  // derive month from date and sync affected employees' sheet rows
  const month = date.slice(0, 7); // YYYY-MM
  const affectedIds = [...new Set(records.map((r) => r.employeeId))];
  await syncSheetFromDaily(month, affectedIds);

  res.json({ date, synced: affectedIds.length });
});

// Aggregate daily records for a month and upsert Sheet rows
// forceAll=true ignores manualOverride (used when user explicitly clicks Sync)
async function syncSheetFromDaily(month, employeeIds, forceAll = false) {
  const objIds = employeeIds.map((id) => new mongoose.Types.ObjectId(id));

  // fetch all daily records for these employees in this month
  const daily = await DailyAttendance.find({
    employee: { $in: objIds },
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
  }).lean();

  // group by employee
  const byEmp = {};
  for (const r of daily) {
    const eid = String(r.employee);
    if (!byEmp[eid]) byEmp[eid] = [];
    byEmp[eid].push(r.status);
  }

  const emps = await Employee.find({ _id: { $in: objIds } }).lean();
  const empMap = Object.fromEntries(emps.map((e) => [String(e._id), e]));

  const Sheet = getSheetModel(month);

  // fetch existing sheet rows to check manualOverride
  const existingRows = await Sheet.find({ employeeId: { $in: objIds } }).lean();
  const overrideMap = Object.fromEntries(existingRows.map((r) => [String(r.employeeId), r.manualOverride]));

  const day = daysInMonth(month);

  await Promise.all(employeeIds.map(async (eid) => {
    if (!forceAll && overrideMap[eid]) return;

    const statuses = byEmp[eid] || [];
    const holidayCount = statuses.filter((s) => s === 'holiday').length;
    const present = statuses.filter((s) => s === 'present').length
                  + statuses.filter((s) => s === 'halfday').length * 0.5
                  + holidayCount;
    const leave   = statuses.filter((s) => s === 'leave').length;
    const absent  = statuses.filter((s) => s === 'absent').length;
    const emp = empMap[eid];
    const cl = emp ? autoCl(emp.doj, month) : 0;
    const ctc = emp?.ctc ?? 0;

    await Sheet.findOneAndUpdate(
      { employeeId: eid },
      { $set: { month, present, leave, absent, holiday: holidayCount, absentOverride: null, day, cl, ctc, deletedAt: null, ...(forceAll && { manualOverride: false }) } },
      { upsert: true, new: true }
    );
  }));
}

// GET /api/daily/employee/:id?month=YYYY-MM  -> calendar data for one employee
exports.getEmployeeCalendar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { month } = req.query;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, 'month is required in YYYY-MM format');

  const records = await DailyAttendance.find({
    employee: id,
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
  }).lean();

  const calendar = Object.fromEntries(records.map((r) => [r.date, r.status]));
  res.json({ employeeId: id, month, calendar });
});

// POST /api/daily/sync?month=YYYY-MM  -> re-aggregate entire month into Sheet
exports.syncMonth = asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, 'month is required in YYYY-MM format');

  // find all employees who have any daily record this month
  const records = await DailyAttendance.find({
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
  }).distinct('employee');

  if (!records.length) return res.json({ month, synced: 0 });

  const employeeIds = records.map((id) => String(id));
  await syncSheetFromDaily(month, employeeIds, false); // respect manualOverride — locked rows are skipped
  res.json({ month, synced: employeeIds.length });
});
