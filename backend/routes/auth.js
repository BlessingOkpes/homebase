// ============================================================
// routes/auth.js v2 — phone first, email optional for landlords
// ============================================================
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
require('dotenv').config();

const generateToken = (user) => jwt.sign(
  { user_id: user.user_id, phone: user.phone_number, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, phone_number, email, password, role, monthly_salary } = req.body;

    if (!first_name || !last_name || !phone_number || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, phone number and password are required.' });
    }

    // Email required for tenants, optional for landlords
    const userRole = ['tenant','landlord'].includes(role) ? role : 'tenant';
    if (userRole === 'tenant' && !email) {
      return res.status(400).json({ success: false, message: 'Email is required for tenants.' });
    }

    // Check phone uniqueness
    const [existingPhone] = await db.execute('SELECT user_id FROM users WHERE phone_number = ?', [phone_number]);
    if (existingPhone.length > 0) return res.status(409).json({ success: false, message: 'An account with this phone number already exists.' });

    // Check email uniqueness if provided
    if (email) {
      const [existingEmail] = await db.execute('SELECT user_id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (existingEmail.length > 0) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (first_name, last_name, phone_number, email, password_hash, role, monthly_salary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [first_name.trim(), last_name.trim(), phone_number.trim(),
       email ? email.toLowerCase().trim() : null,
       passwordHash, userRole, monthly_salary || null]
    );

    const userId = result.insertId;

    // Create affordability profile for tenants
    if (userRole === 'tenant' && monthly_salary) {
      await db.execute('INSERT INTO affordability_profiles (user_id, monthly_salary) VALUES (?, ?)', [userId, monthly_salary]);
    }

    const user  = { user_id: userId, phone_number: phone_number.trim(), role: userRole };
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to HomeBase.',
      token,
      user: { user_id: userId, first_name: first_name.trim(), last_name: last_name.trim(), phone_number: phone_number.trim(), email: email || null, role: userRole },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login  (phone or email + password)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = phone or email

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Phone/email and password are required.' });
    }

    const [rows] = await db.execute(
      `SELECT user_id, first_name, last_name, phone_number, email, password_hash, role, is_active
       FROM users WHERE phone_number = ? OR email = ?`,
      [identifier.trim(), identifier.toLowerCase().trim()]
    );

    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid phone/email or password.' });

    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid phone/email or password.' });

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.first_name}!`,
      token,
      user: { user_id: user.user_id, first_name: user.first_name, last_name: user.last_name, phone_number: user.phone_number, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me
const { protect } = require('../middleware/auth');
router.get('/me', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT user_id, first_name, last_name, phone_number, email, role, monthly_salary, created_at
       FROM users WHERE user_id = ?`, [req.user.user_id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
