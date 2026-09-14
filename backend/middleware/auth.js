// middleware/auth.js v2
const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access only.' });
};

const landlordOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'landlord' || req.user.role === 'admin')) return next();
  return res.status(403).json({ success: false, message: 'Landlord access only.' });
};

const tenantOnly = (req, res, next) => {
  if (req.user && req.user.role === 'tenant') return next();
  return res.status(403).json({ success: false, message: 'Tenant access only.' });
};

module.exports = { protect, adminOnly, landlordOnly, tenantOnly };
