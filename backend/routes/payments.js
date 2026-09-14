// ============================================================
// routes/payments.js v2
// UPDATED: pending/confirmed/rejected flow
//          landlord confirmation & rejection routes
//          payment_confirmations_log audit trail
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect } = require('../middleware/auth');

// ─────────────────────────────────────────
// GET /api/payments
// Tenant views their own payment history
// ─────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT rp.*, p.title AS property_title, p.full_address,
              CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
              u.phone_number AS landlord_phone
       FROM rent_payments rp
       JOIN properties p ON rp.property_id = p.property_id
       JOIN users u      ON rp.landlord_id  = u.user_id
       WHERE rp.tenant_id = ?
       ORDER BY rp.created_at DESC`,
      [req.user.user_id]
    );

    const confirmed = rows.filter(r => r.status === 'confirmed');
    const pending   = rows.filter(r => r.status === 'pending');
    const rejected  = rows.filter(r => r.status === 'rejected');
    const totalPaid = confirmed.reduce((s, r) => s + parseFloat(r.amount), 0);

    return res.status(200).json({
      success: true,
      summary: { confirmed: confirmed.length, pending: pending.length, rejected: rejected.length, totalPaid },
      data: rows,
    });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// GET /api/payments/claims
// Landlord views all pending claims for their properties
// ─────────────────────────────────────────
router.get('/claims', protect, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only landlords can view payment claims.' });
    }

    const status = req.query.status || 'pending';

    const [rows] = await db.execute(
      `SELECT rp.*,
              CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
              t.phone_number AS tenant_phone,
              p.title AS property_title, p.full_address
       FROM rent_payments rp
       JOIN users      t  ON rp.tenant_id   = t.user_id
       JOIN properties p  ON rp.property_id = p.property_id
       WHERE rp.landlord_id = ? AND rp.status = ?
       ORDER BY rp.created_at DESC`,
      [req.user.user_id, status]
    );

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Claims error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// POST /api/payments
// Tenant submits a payment claim
// status starts as 'pending' — landlord must confirm
// ─────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Only tenants can submit payment claims.' });
    }

    const { property_id, amount, payment_month, payment_year,
            period_covered, due_date, date_paid, payment_method, reference_no, notes } = req.body;

    if (!property_id || !amount || !payment_month || !due_date) {
      return res.status(400).json({ success: false, message: 'Property, amount, payment month and due date are required.' });
    }

    const [propRows] = await db.execute('SELECT landlord_id FROM properties WHERE property_id = ?', [property_id]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    const landlord_id = propRows[0].landlord_id;
    const [result] = await db.execute(
      `INSERT INTO rent_payments
         (tenant_id, property_id, landlord_id, amount, payment_month,
          payment_year, period_covered, due_date, date_paid,
          payment_method, reference_no, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [req.user.user_id, property_id, landlord_id, amount, payment_month,
       payment_year || new Date().getFullYear(), period_covered || null,
       due_date, date_paid || null, payment_method || 'bank_transfer',
       reference_no || null, notes || null]
    );

    const paymentId = result.insertId;

    // Notify tenant: claim submitted
    await db.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [req.user.user_id,
       'Payment Claim Submitted ⏳',
       `Your payment claim of ₦${parseFloat(amount).toLocaleString()} for ${payment_month} has been submitted. Awaiting landlord confirmation.`,
       'rent_reminder']
    );

    // Notify landlord: new claim to review
    await db.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [landlord_id,
       'New Payment Claim 💳',
       `A tenant has submitted a payment claim of ₦${parseFloat(amount).toLocaleString()} for ${payment_month}. Please log in to confirm or reject it.`,
       'rent_reminder']
    );

    return res.status(201).json({
      success: true,
      message: 'Payment claim submitted successfully! Awaiting landlord confirmation.',
      payment_id: paymentId,
    });
  } catch (err) {
    console.error('Submit payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// PUT /api/payments/:id/confirm
// Landlord confirms a tenant payment claim
// ─────────────────────────────────────────
router.put('/:id/confirm', protect, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only landlords can confirm payments.' });
    }

    const paymentId = req.params.id;

    // Verify this payment belongs to landlord's property
    const [existing] = await db.execute(
      'SELECT * FROM rent_payments WHERE payment_id = ? AND landlord_id = ? AND status = ?',
      [paymentId, req.user.user_id, 'pending']
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment claim not found or already actioned.' });
    }

    const payment = existing[0];

    // Update payment status to confirmed
    await db.execute(
      `UPDATE rent_payments SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
       WHERE payment_id = ?`,
      [paymentId]
    );

    // Log the confirmation
    await db.execute(
      `INSERT INTO payment_confirmations_log (payment_id, landlord_id, action) VALUES (?, ?, 'confirmed')`,
      [paymentId, req.user.user_id]
    );

    // Notify tenant
    await db.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [payment.tenant_id,
       'Payment Confirmed ✅',
       `Your rent payment of ₦${parseFloat(payment.amount).toLocaleString()} for ${payment.payment_month} has been confirmed by your landlord. Your record is now up to date.`,
       'payment_confirmed']
    );

    return res.status(200).json({ success: true, message: 'Payment confirmed successfully! Tenant has been notified.' });
  } catch (err) {
    console.error('Confirm payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// PUT /api/payments/:id/reject
// Landlord rejects a tenant payment claim
// ─────────────────────────────────────────
router.put('/:id/reject', protect, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only landlords can reject payments.' });
    }

    const paymentId  = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'A reason for rejection is required.' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM rent_payments WHERE payment_id = ? AND landlord_id = ? AND status = ?',
      [paymentId, req.user.user_id, 'pending']
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment claim not found or already actioned.' });
    }

    const payment = existing[0];

    // Update to rejected
    await db.execute(
      `UPDATE rent_payments SET status = 'rejected', rejection_reason = ?, updated_at = NOW()
       WHERE payment_id = ?`,
      [reason, paymentId]
    );

    // Log the rejection
    await db.execute(
      `INSERT INTO payment_confirmations_log (payment_id, landlord_id, action, reason) VALUES (?, ?, 'rejected', ?)`,
      [paymentId, req.user.user_id, reason]
    );

    // Notify tenant
    await db.execute(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
      [payment.tenant_id,
       'Payment Claim Rejected ⚠️',
       `Your payment claim of ₦${parseFloat(payment.amount).toLocaleString()} for ${payment.payment_month} was rejected. Reason: ${reason}. Please contact your landlord to resolve this.`,
       'payment_rejected']
    );

    return res.status(200).json({ success: true, message: 'Payment rejected. Tenant has been notified.' });
  } catch (err) {
    console.error('Reject payment error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────
// GET /api/payments/upcoming
// Tenant upcoming due dates
// ─────────────────────────────────────────
router.get('/upcoming', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT rp.*, p.title AS property_title
       FROM rent_payments rp
       JOIN properties p ON rp.property_id = p.property_id
       WHERE rp.tenant_id = ? AND rp.status = 'pending' AND rp.due_date >= CURDATE()
       ORDER BY rp.due_date ASC LIMIT 5`,
      [req.user.user_id]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
