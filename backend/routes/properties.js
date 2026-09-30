// ============================================================
// routes/properties.js v2
// UPDATED: contact reveal logging, phone hidden by default,
//          single cover-photo upload via Cloudinary
// ============================================================
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const multer      = require('multer');
const cloudinary   = require('../config/cloudinary');

// Store the uploaded file in memory (not on disk) — Render's disk doesn't
// persist between restarts, so we stream straight to Cloudinary instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  }
});

// GET /api/properties — public search with filters
router.get('/', async (req, res) => {
  try {
    const { city, max_price, bedrooms, type, search } = req.query;
    let sql = `
      SELECT p.property_id, p.title, p.description, p.property_type,
             p.bedrooms, p.bathrooms, p.size_sqm, p.monthly_rent,
             p.full_address, p.is_available, p.created_at,
             l.city, l.state,
             CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
             pi.image_url AS cover_image_url
             -- NOTE: landlord phone NOT included here (anti-fraud)
             -- Phone is only returned via /api/properties/:id/contact
      FROM properties p
      JOIN locations l ON p.location_id = l.location_id
      JOIN users     u ON p.landlord_id  = u.user_id
      LEFT JOIN property_images pi ON pi.property_id = p.property_id AND pi.is_cover = 1
      WHERE p.is_available = 1 AND p.is_approved = 1
    `;
    const params = [];

    if (city)      { sql += ' AND l.city LIKE ?';          params.push(`%${city}%`); }
    if (max_price) { sql += ' AND p.monthly_rent <= ?';    params.push(parseFloat(max_price)); }
    if (bedrooms !== undefined && bedrooms !== '') { sql += ' AND p.bedrooms = ?'; params.push(parseInt(bedrooms)); }
    if (type)      { sql += ' AND p.property_type = ?';    params.push(type); }
    if (search)    { sql += ' AND (p.title LIKE ? OR p.full_address LIKE ? OR l.city LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }

    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await db.execute(sql, params);

    for (let prop of rows) {
      const [amenities] = await db.execute('SELECT amenity_name FROM property_amenities WHERE property_id = ?', [prop.property_id]);
      prop.amenities = amenities.map(a => a.amenity_name);
    }

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Get properties error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/properties/:id — single property (no phone)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, l.city, l.state,
              CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
              pi.image_url AS cover_image_url
              -- Phone excluded intentionally
       FROM properties p
       JOIN locations l ON p.location_id = l.location_id
       JOIN users     u ON p.landlord_id  = u.user_id
       LEFT JOIN property_images pi ON pi.property_id = p.property_id AND pi.is_cover = 1
       WHERE p.property_id = ? AND p.is_approved = 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Property not found.' });

    const prop = rows[0];
    const [amenities] = await db.execute('SELECT amenity_name FROM property_amenities WHERE property_id = ?', [prop.property_id]);
    prop.amenities = amenities.map(a => a.amenity_name);

    return res.status(200).json({ success: true, data: prop });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/properties/:id/contact
// Tenant clicks "Contact Landlord" — reveals phone + logs the reveal
router.post('/:id/contact', protect, async (req, res) => {
  try {
    const propertyId = req.params.id;

    // Get landlord phone and address
    const [rows] = await db.execute(
      `SELECT u.phone_number AS landlord_phone, u.first_name, u.last_name,
              p.full_address
       FROM properties p
       JOIN users u ON p.landlord_id = u.user_id
       WHERE p.property_id = ? AND p.is_approved = 1`,
      [propertyId]
    );

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Property not found.' });

    // Log the reveal for analytics/fraud monitoring
    await db.execute(
      `INSERT INTO contact_reveals_log (tenant_id, property_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE revealed_at = NOW()`,
      [req.user.user_id, propertyId]
    );

    return res.status(200).json({
      success:  true,
      message:  'Landlord contact details revealed. Visit the property in person before making any payment.',
      data: {
        landlord_name:  `${rows[0].first_name} ${rows[0].last_name}`,
        landlord_phone: rows[0].landlord_phone,
        full_address:   rows[0].full_address,
        warning:        'Never pay rent without visiting the property first. HomeBase does not handle bank transfers.'
      }
    });
  } catch (err) {
    console.error('Contact reveal error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/properties — landlord adds new property
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only landlords can post listings.' });
    }

    const { location_id, title, description, property_type, bedrooms, bathrooms, size_sqm, monthly_rent, full_address, amenities } = req.body;

    if (!title || !monthly_rent || !full_address || !location_id || !property_type) {
      return res.status(400).json({ success: false, message: 'Title, rent, address, location and type are required.' });
    }

    const [result] = await db.execute(
      `INSERT INTO properties (landlord_id, location_id, title, description, property_type, bedrooms, bathrooms, size_sqm, monthly_rent, full_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, location_id, title, description || null, property_type, bedrooms || 1, bathrooms || 1, size_sqm || null, monthly_rent, full_address]
    );

    const propertyId = result.insertId;

    if (amenities && Array.isArray(amenities)) {
      for (const amenity of amenities) {
        await db.execute('INSERT INTO property_amenities (property_id, amenity_name) VALUES (?, ?)', [propertyId, amenity]);
      }
    }

    return res.status(201).json({ success: true, message: 'Property submitted for admin approval.', property_id: propertyId });
  } catch (err) {
    console.error('Create property error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/properties/:id/image — landlord uploads/replaces the single cover photo
// Single-photo version: one cover image per property (property_images.is_cover = 1)
router.post('/:id/image', protect, upload.single('image'), async (req, res) => {
  try {
    const propertyId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file received.' });
    }

    // Ownership check — same pattern used for payment claims: derive the
    // real landlord_id server-side and compare, never trust the client.
    const [propRows] = await db.execute('SELECT landlord_id FROM properties WHERE property_id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (req.user.role !== 'admin' && propRows[0].landlord_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'You can only upload photos for your own listings.' });
    }

    // Upload the buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'homebase/properties', resource_type: 'image' },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    // Single cover-photo model: replace any existing cover for this property
    await db.execute('DELETE FROM property_images WHERE property_id = ? AND is_cover = 1', [propertyId]);
    await db.execute(
      'INSERT INTO property_images (property_id, image_url, is_cover) VALUES (?, ?, 1)',
      [propertyId, uploadResult.secure_url]
    );

    return res.status(200).json({ success: true, message: 'Cover photo uploaded.', image_url: uploadResult.secure_url });
  } catch (err) {
    console.error('Property image upload error:', err);
    return res.status(500).json({ success: false, message: 'Server error during image upload.' });
  }
});

// POST /api/properties/:id/save — tenant saves a property
router.post('/:id/save', protect, async (req, res) => {
  try {
    const [existing] = await db.execute('SELECT saved_id FROM saved_properties WHERE tenant_id = ? AND property_id = ?', [req.user.user_id, req.params.id]);
    if (existing.length > 0) {
      await db.execute('DELETE FROM saved_properties WHERE tenant_id = ? AND property_id = ?', [req.user.user_id, req.params.id]);
      return res.status(200).json({ success: true, saved: false, message: 'Removed from saved.' });
    } else {
      await db.execute('INSERT INTO saved_properties (tenant_id, property_id) VALUES (?, ?)', [req.user.user_id, req.params.id]);
      return res.status(200).json({ success: true, saved: true, message: 'Property saved!' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/properties/saved/list
router.get('/saved/list', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, l.city, l.state, sp.saved_at, pi.image_url AS cover_image_url
       FROM saved_properties sp
       JOIN properties p ON sp.property_id = p.property_id
       JOIN locations  l ON p.location_id  = l.location_id
       LEFT JOIN property_images pi ON pi.property_id = p.property_id AND pi.is_cover = 1
       WHERE sp.tenant_id = ? ORDER BY sp.saved_at DESC`,
      [req.user.user_id]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// PATCH /api/properties/:id/approve — admin approves a pending listing
router.patch('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await db.execute(
      'UPDATE properties SET is_approved = 1 WHERE property_id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    return res.status(200).json({ success: true, message: 'Property approved and now live.' });
  } catch (err) {
    console.error('Approve property error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PATCH /api/properties/:id/reject — admin rejects a pending listing
router.patch('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await db.execute(
      'DELETE FROM properties WHERE property_id = ? AND is_approved = 0',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Property not found or already approved.' });
    }
    return res.status(200).json({ success: true, message: 'Property rejected.' });
  } catch (err) {
    console.error('Reject property error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// GET /api/properties/admin/pending — admin views all pending listings
router.get('/admin/pending', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.property_id, p.title, p.property_type, p.bedrooms, p.bathrooms,
              p.monthly_rent, p.full_address, p.created_at,
              l.city, l.state,
              CONCAT(u.first_name,' ',u.last_name) AS landlord_name,
              pi.image_url AS cover_image_url
       FROM properties p
       JOIN locations l ON p.location_id = l.location_id
       JOIN users     u ON p.landlord_id  = u.user_id
       LEFT JOIN property_images pi ON pi.property_id = p.property_id AND pi.is_cover = 1
       WHERE p.is_approved = 0
       ORDER BY p.created_at DESC`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Get pending properties error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;