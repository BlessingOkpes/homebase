// routes/admin.js: read-only admin endpoints (admin role only)
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [[users]] = await db.execute(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(role='tenant'),0)   AS tenants,
              COALESCE(SUM(role='landlord'),0) AS landlords,
              COALESCE(SUM(role='admin'),0)    AS admins
       FROM users`);
    const [[props]] = await db.execute(
      `SELECT COALESCE(SUM(is_approved=1),0) AS approved,
              COALESCE(SUM(is_approved=0),0) AS pending
       FROM properties`);
    const [[pays]] = await db.execute(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status='confirmed'),0) AS confirmed,
              COALESCE(SUM(status='pending'),0)   AS pending,
              COALESCE(SUM(status='rejected'),0)  AS rejected,
              COALESCE(SUM(status='confirmed' AND YEAR(confirmed_at)=YEAR(CURDATE()) AND MONTH(confirmed_at)=MONTH(CURDATE())),0) AS confirmed_this_month,
              COALESCE(SUM(CASE WHEN status='confirmed' THEN amount END),0) AS confirmed_volume
       FROM rent_payments`);
    return res.status(200).json({ success: true, data: { users, properties: props, payments: pays } });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/users (newest first; never returns password hashes)
router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone_number, u.role,
              COALESCE(u.monthly_salary, ap.monthly_salary) AS monthly_salary,
              ap.preferred_location, u.is_active, u.created_at
       FROM users u
       LEFT JOIN affordability_profiles ap ON ap.user_id = u.user_id
       ORDER BY u.created_at DESC`);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/payments (all payment claims, newest first)
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT rp.payment_id, rp.amount, rp.payment_month, rp.date_paid,
              rp.payment_method, rp.status, rp.created_at,
              CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
              CONCAT(l.first_name,' ',l.last_name) AS landlord_name,
              p.title AS property_title
       FROM rent_payments rp
       JOIN users      t ON rp.tenant_id   = t.user_id
       JOIN users      l ON rp.landlord_id = l.user_id
       JOIN properties p ON rp.property_id = p.property_id
       ORDER BY rp.created_at DESC
       LIMIT 500`);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Admin payments error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;