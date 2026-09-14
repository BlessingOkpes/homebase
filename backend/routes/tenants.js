// routes/tenants.js v2 — tenant dashboard data
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect } = require('../middleware/auth');

// GET /api/tenants/dashboard — all data for tenant dashboard in one call
router.get('/dashboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') return res.status(403).json({ success: false, message: 'Tenants only.' });

    // Payment summary
    const [payments] = await db.execute(
      `SELECT rp.*, p.title AS property_title, p.full_address,
              CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
              u.phone_number AS landlord_phone
       FROM rent_payments rp
       JOIN properties p ON rp.property_id = p.property_id
       JOIN users u ON rp.landlord_id = u.user_id
       WHERE rp.tenant_id = ? ORDER BY rp.created_at DESC`,
      [req.user.user_id]
    );

    // Affordability profile
    const [profile] = await db.execute('SELECT * FROM affordability_profiles WHERE user_id = ?', [req.user.user_id]);

    // Notifications
    const [notifs] = await db.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.user.user_id]
    );

    // Saved properties
    const [saved] = await db.execute(
      `SELECT p.property_id, p.title, p.monthly_rent, l.city, l.state
       FROM saved_properties sp
       JOIN properties p ON sp.property_id = p.property_id
       JOIN locations l ON p.location_id = l.location_id
       WHERE sp.tenant_id = ? ORDER BY sp.saved_at DESC LIMIT 5`,
      [req.user.user_id]
    );

    // Active tenancy
    const [tenancy] = await db.execute(
      `SELECT t.*, p.title AS property_title, p.full_address,
              CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
              u.phone_number AS landlord_phone
       FROM tenancies t
       JOIN properties p ON t.property_id = p.property_id
       JOIN users u ON t.landlord_id = u.user_id
       WHERE t.tenant_id = ? AND t.status = 'active' LIMIT 1`,
      [req.user.user_id]
    );

    const confirmed = payments.filter(p => p.status === 'confirmed');
    const pending   = payments.filter(p => p.status === 'pending');
    const rejected  = payments.filter(p => p.status === 'rejected');
    const totalPaid = confirmed.reduce((s, p) => s + parseFloat(p.amount), 0);
    const unread    = notifs.filter(n => !n.is_read).length;

    return res.status(200).json({
      success: true,
      data: {
        summary: { confirmed: confirmed.length, pending: pending.length, rejected: rejected.length, totalPaid, unreadNotifs: unread },
        payments,
        profile: profile[0] || null,
        notifications: notifs,
        saved,
        tenancy: tenancy[0] || null,
      }
    });
  } catch (err) {
    console.error('Tenant dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
