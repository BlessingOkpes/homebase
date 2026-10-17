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
      `SELECT p.property_id, p.title, p.monthly_rent, l.city, l.state,
              pi.image_url AS cover_image_url
       FROM saved_properties sp
       JOIN properties p ON sp.property_id = p.property_id
       JOIN locations l ON p.location_id = l.location_id
       LEFT JOIN property_images pi ON pi.property_id = p.property_id AND pi.is_cover = 1
       WHERE sp.tenant_id = ? ORDER BY sp.saved_at DESC`,
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

// ─────────────────────────────────────────
// GET /api/tenants/landlord
// Landlord: all active tenancies on their properties
// ─────────────────────────────────────────
router.get('/landlord', protect, async (req, res) => {
  try {
    if (req.user.role !== 'landlord') return res.status(403).json({ success: false, message: 'Landlords only.' });
    const [rows] = await db.execute(
      `SELECT t.tenancy_id, t.property_id, t.start_date, t.monthly_rent,
              p.title AS property_title,
              CONCAT(u.first_name, ' ', u.last_name) AS tenant_name,
              u.phone_number AS tenant_phone, u.email AS tenant_email
       FROM tenancies t
       JOIN properties p ON t.property_id = p.property_id
       JOIN users u ON t.tenant_id = u.user_id
       WHERE t.landlord_id = ? AND t.status = 'active'
       ORDER BY t.start_date DESC`,
      [req.user.user_id]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Landlord tenants error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// POST /api/tenants/add
// Landlord adds a registered tenant to one of their available listings
// ─────────────────────────────────────────
router.post('/add', protect, async (req, res) => {
  let conn;
  try {
    if (req.user.role !== 'landlord') return res.status(403).json({ success: false, message: 'Landlords only.' });

    const email       = String(req.body.email || '').trim().toLowerCase();
    const property_id = Number(req.body.property_id);
    const start_date  = String(req.body.start_date || '');
    if (!email || !property_id || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) || isNaN(new Date(start_date))) {
      return res.status(400).json({ success: false, message: 'Tenant email, listing and move-in date are required.' });
    }

    const [users] = await db.execute('SELECT user_id, first_name, role, is_active FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'No HomeBase account found for that email. Ask the tenant to register first.' });
    }
    const tenant = users[0];
    if (tenant.role !== 'tenant' || !tenant.is_active) {
      return res.status(400).json({ success: false, message: 'That account is not an active tenant account.' });
    }

    const [props] = await db.execute(
      'SELECT property_id, title, monthly_rent, is_available, is_approved FROM properties WHERE property_id = ? AND landlord_id = ?',
      [property_id, req.user.user_id]
    );
    if (props.length === 0) return res.status(404).json({ success: false, message: 'Listing not found.' });
    const prop = props[0];
    if (!prop.is_approved)  return res.status(400).json({ success: false, message: 'This listing has not been approved yet.' });
    if (!prop.is_available) return res.status(409).json({ success: false, message: 'This listing is already occupied.' });

    const [existing] = await db.execute("SELECT tenancy_id FROM tenancies WHERE tenant_id = ? AND status = 'active' LIMIT 1", [tenant.user_id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'This tenant already rents a home.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Claim the listing only if it is still available (guards against two requests at once)
    const [claimed] = await conn.execute(
      'UPDATE properties SET is_available = 0 WHERE property_id = ? AND landlord_id = ? AND is_available = 1',
      [property_id, req.user.user_id]
    );
    if (claimed.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'This listing is already occupied.' });
    }

    const [result] = await conn.execute(
      `INSERT INTO tenancies (tenant_id, property_id, landlord_id, start_date, monthly_rent, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [tenant.user_id, property_id, req.user.user_id, start_date, prop.monthly_rent]
    );

    await conn.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [tenant.user_id, 'You have been added to a home 🏠',
       `Your landlord has added you as the tenant of "${prop.title}". You can now see it on your dashboard and submit rent payments for it.`,
       'system']
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: `Tenant added. "${prop.title}" is now marked occupied.`,
      tenancy_id: result.insertId,
    });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (e) {} }
    console.error('Add tenant error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    if (conn) conn.release();
  }
});

// ─────────────────────────────────────────
// PUT /api/tenants/:id/end
// Landlord ends an active tenancy and frees the home
// ─────────────────────────────────────────
router.put('/:id/end', protect, async (req, res) => {
  let conn;
  try {
    if (req.user.role !== 'landlord') return res.status(403).json({ success: false, message: 'Landlords only.' });

    const [rows] = await db.execute(
      `SELECT t.tenancy_id, t.tenant_id, t.property_id, p.title
       FROM tenancies t JOIN properties p ON t.property_id = p.property_id
       WHERE t.tenancy_id = ? AND t.landlord_id = ? AND t.status = 'active'`,
      [req.params.id, req.user.user_id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Active tenancy not found.' });
    const ten = rows[0];

    conn = await db.getConnection();
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE tenancies SET status = 'terminated', end_date = GREATEST(CURDATE(), start_date) WHERE tenancy_id = ?",
      [ten.tenancy_id]
    );
    await conn.execute('UPDATE properties SET is_available = 1 WHERE property_id = ?', [ten.property_id]);
    await conn.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [ten.tenant_id, 'Tenancy ended',
       `Your landlord has ended your tenancy at "${ten.title}".`,
       'system']
    );
    await conn.commit();
    return res.status(200).json({ success: true, message: 'Tenancy ended. The home is available again.' });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (e) {} }
    console.error('End tenancy error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    if (conn) conn.release();
  }
});
module.exports = router;
