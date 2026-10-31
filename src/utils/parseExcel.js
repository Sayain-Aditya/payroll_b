const XLSX = require('xlsx');

const HEADERS = {
  sr: 'srNo', place: 'place', name: 'name', designation: 'designation', dept: 'dept',
  ctcmonth: 'ctc', ctc: 'ctc', doj: 'doj', day: 'day', present: 'present',
  leave: 'leave', ew: 'ew', cl: 'cl', totalabsent: 'absent', absent: 'absent',
  bankname: 'bankName', bank: 'bankName',
  accountno: 'accountNo', accno: 'accountNo', accountnumber: 'accountNo', bankaccountno: 'accountNo',
  ifsc: 'ifsc', ifsccode: 'ifsc',
  company: 'company', companyname: 'company', client: 'company',
};

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const empty = (v) => v === '' || v == null;

function toIso(v) {
  if (empty(v)) return '';
  let d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return '';
  d = new Date(d.getTime() + 12 * 3600 * 1000); // guard timezone skew from Excel dates
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normDept(v) {
  const s = String(v || '').trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';
}

/** @returns {{ rows: object[], warnings: string[] }} */
function parseExcel(buffer, companyOverride = '') {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });

  const rows = [];
  const warnings = [];

  raw.forEach((r, i) => {
    const o = {};
    for (const [key, val] of Object.entries(r)) {
      const field = HEADERS[norm(key)];
      if (field) o[field] = val;
    }
    const name = String(o.name || '').trim();
    if (!name) return;
    if (/^rent$/i.test(String(o.designation || '').trim())) return;

    const line = i + 2;
    const num = (field) => {
      if (empty(o[field])) return null;
      const n = Number(o[field]);
      if (Number.isFinite(n) && n >= 0) return n;
      warnings.push(`Row ${line} (${name}): ${field} has invalid value "${o[field]}" - ignored`);
      return null;
    };

    rows.push({
      name,
      place: String(o.place || '').trim(),
      designation: String(o.designation || '').trim(),
      dept: normDept(o.dept),
      doj: toIso(o.doj),
      ctc: num('ctc'),
      day: num('day'),
      present: num('present'),
      leave: num('leave'),
      ew: num('ew'),
      cl: num('cl'),
      absent: num('absent'),
      bankName: String(o.bankName || '').trim(),
      accountNo: String(o.accountNo || '').trim(),
      ifsc: String(o.ifsc || '').trim().toUpperCase(),
      company: companyOverride || String(o.company || '').trim(),
    });
  });

  return { rows, warnings };
}

module.exports = { parseExcel };
