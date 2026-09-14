// ============================================================
//  HomeBase Backend v2 — server.js
//  Configured for Render deployment
//  Serves both API and frontend static files
// ============================================================
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve Frontend Static Files ─────────────────────────────
// Render will serve all HTML files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Database ────────────────────────────────────────────────
require('./config/db');

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/properties',     require('./routes/properties'));
app.use('/api/payments',       require('./routes/payments'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/affordability',  require('./routes/affordability'));
app.use('/api/tenants',        require('./routes/tenants'));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ── Catch All — serve index.html for any unknown route ──────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🏠 HomeBase running on port ${PORT}`);
});
