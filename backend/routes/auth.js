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
    const { first_name, last_name, phone_number, email, password, role, monthly_salary, preferred_location } = req.body;
    if (!first_name || !last_name || !phone_number || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, phone number and password are required.' });
    }

    // Email required for tenants, optional for landlords
    const userRole = ['tenant','landlord'].includes(role) ? role : 'tenant';
    if (userRole === 'tenant' && !email) {
      return res.status(400).json({ success: false, message: 'Email is required for tenants.' });
    }

    // Tenants give a salary (for the rent budget) and a preferred location from our list
    let preferredLocation = null;
    if (userRole === 'tenant') {
      if (!monthly_salary || isNaN(monthly_salary) || Number(monthly_salary) <= 0) {
        return res.status(400).json({ success: false, message: 'Monthly salary is required for tenants.' });
      }
      if (!preferred_location) {
        return res.status(400).json({ success: false, message: 'Please choose your preferred location.' });
      }
      const [locRows] = await db.execute("SELECT 1 FROM locations WHERE CONCAT(city, ', ', state) = ?", [preferred_location]);
      if (locRows.length === 0) {
        return res.status(400).json({ success: false, message: 'Please choose a location from the list.' });
      }
      preferredLocation = preferred_location;
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
      await db.execute('INSERT INTO affordability_profiles (user_id, monthly_salary, preferred_location) VALUES (?, ?, ?)', [userId, monthly_salary, preferredLocation]);
    }

    // Tell every admin about the new account (never blocks registration)
    try {
      await db.execute(
        `INSERT INTO notifications (user_id, title, message, type)
         SELECT user_id, ?, ?, 'system' FROM users WHERE role = 'admin' AND is_active = 1`,
        [`New ${userRole} registered`, `${first_name.trim()} ${last_name.trim()} just registered as a ${userRole}.`]
      );
    } catch (notifyErr) { console.error('Admin notify error:', notifyErr); }

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

// GET /api/auth/locations — public list of the locations used for listings and tenant preferences
router.get('/locations', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT location_id, city, state FROM locations ORDER BY state, city');
    return res.status(200).json({
      success: true,
      data: rows.map(r => ({ location_id: r.location_id, city: r.city, state: r.state, label: `${r.city}, ${r.state}` }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
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
