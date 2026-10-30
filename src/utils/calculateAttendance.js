const rules = require('../config/attendanceRules');

function monthsSince(doj, monthEnd) {
  let m = (monthEnd.getFullYear() - doj.getFullYear()) * 12 + (monthEnd.getMonth() - doj.getMonth());
  if (monthEnd.getDate() < doj.getDate()) m -= 1;
  return m;
}

/**
 * @param {{day, present, leave, ew, absentInput, doj}} input
 * @param {string} month "YYYY-MM"
 */
function calculateAttendance(input, month) {
  const [y, m] = month.split('-').map(Number);
  const monthEnd = new Date(y, m, 0);
  const day = input.day || monthEnd.getDate();
  const present = input.present || 0;
  const leave = input.leave || 0;
  const ew = input.ew || 0;

  const doj = input.doj ? new Date(input.doj) : null;
  const eligible = doj && monthsSince(doj, monthEnd) >= rules.clEligibleMonths;
  const cl = eligible ? Math.min(leave, rules.clPerMonth) : 0;

  const absent = input.absentInput ?? Math.max(0, day - present - leave);
  const totalWorking = present + ew + cl;
  const dayDeduction = absent * rules.deductionPerAbsent;
  const totalAttendance = Math.max(0, totalWorking - dayDeduction);

  return { day, cl, absent, totalWorking, dayDeduction, totalAttendance };
}

module.exports = { calculateAttendance };
