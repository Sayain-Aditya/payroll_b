const Employee = require('../models/Employee');
const Sheet = require('../models/Sheet');
const asyncHandler = require('../utils/asyncHandler');
const { daysInMonth, autoCl } = require('../utils/calc');
const { HIGH_ABSENT_DAYS, SALARY_DROP_PCT } = require('../config/alertRules');
const { CL_AFTER_MONTHS } = require('../config/attendanceRules');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function prevMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function netSalary(row) {
  if (!row) return null;
  const { ctc, day, present = 0, leave = 0, ew = 0, cl = 0, absent = 0, absentOverride } = row;
  if (!ctc || !day) return null;
  const ab = absentOverride ?? Math.max(0, day - present - leave - cl);
  const deduction = leave * 1 + ab * 1.5;
  const attendance = day - leave - (ab * 1.5) + ew + cl;
  return (ctc / day) * Math.max(0, attendance);
}

// GET /api/alerts?month=YYYY-MM
exports.getAlerts = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!MONTH_RE.test(month || '')) return res.status(400).json({ error: 'month required in YYYY-MM format' });

  const prev = prevMonth(month);
  const day = daysInMonth(month);

  // fetch all active employees + current + prev month sheets in parallel
  const [employees, currentRows, prevRows] = await Promise.all([
    Employee.find({ deletedAt: null }, 'name designation dept doj ctc').lean(),
    Sheet.find({ month, deletedAt: null }).lean(),
    Sheet.find({ month: prev, deletedAt: null }).lean(),
  ]);

  const currentMap = Object.fromEntries(currentRows.map((r) => [String(r.employeeId), r]));
  const prevMap = Object.fromEntries(prevRows.map((r) => [String(r.employeeId), r]));

  const alerts = [];

  for (const emp of employees) {
    const eid = String(emp._id);
    const row = currentMap[eid];
    const empName = emp.name;
    const empId = eid;

    // 1. Missing attendance
    if (!row) {
      alerts.push({ type: 'missing_attendance', severity: 'warn', empId, empName, dept: emp.dept, message: `No attendance recorded for ${empName}` });
      continue; // no row = skip other checks
    }

    // 2. High absence
    const absent = row.absentOverride ?? Math.max(0, (row.day || day) - (row.present || 0) - (row.leave || 0) - (row.cl || 0));
    if (absent >= HIGH_ABSENT_DAYS) {
      alerts.push({ type: 'high_absence', severity: 'error', empId, empName, dept: emp.dept, message: `${empName} is absent ${absent} day${absent > 1 ? 's' : ''} this month`, value: absent });
    }

    // 3. Data check — present+leave+cl+absent != day, CTC=0, missing DOJ
    const rowDay = row.day || day;
    const sum = (row.present || 0) + (row.leave || 0) + (row.cl || 0) + absent;
    if (Math.abs(sum - rowDay) > 0.01) {
      alerts.push({ type: 'data_check', severity: 'warn', empId, empName, dept: emp.dept, message: `${empName}: attendance sum (${sum}) ≠ working days (${rowDay})` });
    }
    if (!emp.ctc || emp.ctc === 0) {
      alerts.push({ type: 'data_check', severity: 'warn', empId, empName, dept: emp.dept, message: `${empName} has CTC set to ₹0` });
    }
    if (!emp.doj) {
      alerts.push({ type: 'data_check', severity: 'warn', empId, empName, dept: emp.dept, message: `${empName} has no date of joining` });
    }

    // 4. Salary drop vs last month
    const net = netSalary(row);
    const prevNet = netSalary(prevMap[eid]);
    if (net !== null && prevNet !== null && prevNet > 0) {
      const drop = ((prevNet - net) / prevNet) * 100;
      if (drop >= SALARY_DROP_PCT) {
        alerts.push({ type: 'salary_drop', severity: 'error', empId, empName, dept: emp.dept, message: `${empName}'s salary dropped ${drop.toFixed(0)}% vs last month`, value: Math.round(drop) });
      }
    }
  }

  // 5. CL now available — employees who just crossed CL_AFTER_MONTHS this month
  for (const emp of employees) {
    if (!emp.doj) continue;
    const clNow = autoCl(emp.doj, month);
    const clPrev = autoCl(emp.doj, prev);
    if (clNow > 0 && clPrev === 0) {
      alerts.push({ type: 'cl_available', severity: 'info', empId: String(emp._id), empName: emp.name, dept: emp.dept, message: `${emp.name} is now eligible for Casual Leave` });
    }
  }

  // 6. Work anniversary — joining month matches current month
  const [cy, cm] = month.split('-').map(Number);
  for (const emp of employees) {
    if (!emp.doj) continue;
    const [, dm, ] = emp.doj.split('-').map(Number);
    const [dy] = emp.doj.split('-').map(Number);
    if (dm === cm && dy !== cy) {
      const years = cy - dy;
      alerts.push({ type: 'work_anniversary', severity: 'info', empId: String(emp._id), empName: emp.name, dept: emp.dept, message: `${emp.name} completes ${years} year${years > 1 ? 's' : ''} this month 🎉` });
    }
  }

  // summary counts
  const missing = alerts.filter((a) => a.type === 'missing_attendance').length;
  res.json({ alerts, missing, total: alerts.length });
});
