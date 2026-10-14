// routes/notifications.js v2
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.user_id]);
    const unread = rows.filter(r => !r.is_read).length;
    return res.status(200).json({ success: true, unread, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/read-all', protect, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.user_id]);
    return res.status(200).json({ success: true, message: 'All marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/:id/read', protect, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);
    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/notifications — clear all of my notifications
router.delete('/', protect, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM notifications WHERE user_id = ?', [req.user.user_id]);
    return res.status(200).json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/notifications/:id — delete one of my notifications
router.delete('/:id', protect, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM notifications WHERE notification_id = ? AND user_id = ?', [req.params.id, req.user.user_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/notifications/broadcast — admin sends a message to all users, all tenants or all landlords
router.post('/broadcast', protect, adminOnly, async (req, res) => {
  try {
    const { audience, title, message } = req.body;
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'A title and a message are required.' });
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'The title is too long (200 characters max).' });
    }
    const roles = audience === 'tenants' ? ['tenant'] : audience === 'landlords' ? ['landlord'] : ['tenant', 'landlord'];
    const marks = roles.map(() => '?').join(', ');
    const [result] = await db.execute(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT user_id, ?, ?, 'system' FROM users WHERE role IN (${marks}) AND is_active = 1`,
      [title.trim(), message.trim(), ...roles]
    );
    return res.status(201).json({ success: true, sent: result.affectedRows, message: `Notification sent to ${result.affectedRows} user${result.affectedRows === 1 ? '' : 's'}.` });
  } catch (err) {
    console.error('Broadcast error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;