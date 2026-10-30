const { CL_AFTER_MONTHS, CL_PER_MONTH } = require('../config/attendanceRules');

exports.daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

exports.autoCl = (doj, month) => {
  const s = String(doj || '').slice(0, 10);
  const [dy, dm, dd] = s.split('-').map(Number);
  if (!dy) return 0;
  const [y, m] = month.split('-').map(Number);
  let months = (y - dy) * 12 + (m - dm);
  if (new Date(y, m, 0).getDate() < dd) months -= 1;
  return months >= CL_AFTER_MONTHS ? CL_PER_MONTH : 0;
};
