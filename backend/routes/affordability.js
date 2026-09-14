// ============================================================
// routes/affordability.js v2
// UPDATED: monthly_salary replaces monthly_income
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect } = require('../middleware/auth');

// GET /api/affordability — get tenant budget profile
router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM affordability_profiles WHERE user_id = ?', [req.user.user_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Profile not found.' });
    const profile = rows[0];
    return res.status(200).json({
      success: true,
      data: { ...profile, max_rent_budget: parseFloat(profile.monthly_salary) * 0.30, rule: '30% of monthly salary' }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/affordability — update salary and preferences
router.put('/', protect, async (req, res) => {
  try {
    const { monthly_salary, preferred_location, preferred_bedrooms, preferred_type } = req.body;
    if (!monthly_salary || isNaN(monthly_salary) || monthly_salary < 0) {
      return res.status(400).json({ success: false, message: 'Valid monthly salary is required.' });
    }
    await db.execute(
      `INSERT INTO affordability_profiles (user_id, monthly_salary, preferred_location, preferred_bedrooms, preferred_type)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_salary=VALUES(monthly_salary),
       preferred_location=VALUES(preferred_location),
       preferred_bedrooms=VALUES(preferred_bedrooms),
       preferred_type=VALUES(preferred_type), updated_at=NOW()`,
      [req.user.user_id, monthly_salary, preferred_location || null, preferred_bedrooms || null, preferred_type || null]
    );
    await db.execute('UPDATE users SET monthly_salary = ? WHERE user_id = ?', [monthly_salary, req.user.user_id]);
    const maxRent = parseFloat(monthly_salary) * 0.30;
    return res.status(200).json({ success: true, message: 'Budget profile updated.', monthly_salary: parseFloat(monthly_salary), max_rent_budget: maxRent });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/affordability/calculate?salary=250000 — public, no auth
router.get('/calculate', (req, res) => {
  const salary = parseFloat(req.query.salary);
  if (!salary || isNaN(salary) || salary <= 0) {
    return res.status(400).json({ success: false, message: 'Valid salary is required.' });
  }
  const maxRent = salary * 0.30;
  return res.status(200).json({
    success: true, monthly_salary: salary, max_rent_budget: maxRent, rule: '30% of gross monthly salary',
    note: `With a salary of ₦${salary.toLocaleString()}, your max safe rent is ₦${maxRent.toLocaleString()}`
  });
});

module.exports = router;
