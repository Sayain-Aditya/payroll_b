const Holiday = require('../models/Holiday');
const Sheet = require('../models/Sheet');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/holidays?month=YYYY-MM
exports.list = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const filter = month ? { month } : {};
  const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
  res.json({ holidays: holidays.map(toH) });
});

// POST /api/holidays  { date, name }
exports.create = asyncHandler(async (req, res) => {
  const { date, name } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'date required in YYYY-MM-DD format');
  if (!name?.trim()) throw new ApiError(400, 'name is required');
  const month = date.slice(0, 7);
  const h = await Holiday.create({ date, name: name.trim(), month });
  res.status(201).json(toH(h.toObject()));
});

// DELETE /api/holidays/:id
exports.remove = asyncHandler(async (req, res) => {
  const h = await Holiday.findByIdAndDelete(req.params.id);
  if (!h) throw new ApiError(404, 'Holiday not found');
  res.json({ ok: true });
});

// POST /api/holidays/apply  { month } — sets holiday count on all sheet rows for that month
exports.apply = asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, 'month required in YYYY-MM format');

  const count = await Holiday.countDocuments({ month });
  // update all sheet rows for this month
  const result = await Sheet.updateMany({ month, deletedAt: null }, { $set: { holiday: count } });
  res.json({ month, holidayCount: count, rowsUpdated: result.modifiedCount });
});

function toH(h) {
  return { id: String(h._id), date: h.date, name: h.name, month: h.month };
}
