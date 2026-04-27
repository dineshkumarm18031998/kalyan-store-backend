const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

// Register store + owner
router.post('/register', async (req, res) => {
  const { storeName, ownerName, phone, password, city, language } = req.body;
  if (!storeName || !ownerName || !phone || !password)
    return res.status(400).json({ success: false, message: 'All fields required' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const storeResult = await client.query(
      'INSERT INTO stores (name, owner_name, phone, city, language) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [storeName, ownerName, phone, city || '', language || 'ta']
    );
    const storeId = storeResult.rows[0].id;
    const hash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      'INSERT INTO users (store_id, name, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, role',
      [storeId, ownerName, phone, hash, 'owner']
    );

    // Insert demo products
    const demoProducts = [
      ['Plastic Chair', 'நாற்காலி', 'furniture', '🪑', 100, 5],
      ['Round Table', 'மேஜை', 'furniture', '🪞', 20, 50],
      ['Steel Vessel Set', 'பாத்திரம்', 'vessels', '🍲', 50, 30],
      ['Tent / Pandal', 'பந்தல்', 'tent', '⛺', 5, 500],
      ['Water Pot (Kalasam)', 'கலசம்', 'vessels', '🏺', 30, 15],
    ];
    for (const [name, nameTa, cat, emoji, qty, rate] of demoProducts) {
      await client.query(
        'INSERT INTO products (store_id, name, name_ta, category, emoji, total_qty, rate_per_day) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [storeId, name, nameTa, cat, emoji, qty, rate]
      );
    }

    await client.query('COMMIT');
    const token = jwt.sign({ userId: userResult.rows[0].id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ success: true, token, user: { ...userResult.rows[0], store_name: storeName, store_id: storeId } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password)
    return res.status(400).json({ success: false, message: 'Phone and password required' });

  try {
    const result = await db.query(
      'SELECT u.*, s.name as store_name, s.currency, s.language FROM users u JOIN stores s ON u.store_id = s.id WHERE u.phone = $1 AND u.is_active = true',
      [phone]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get profile
router.get('/me', auth, async (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json({ success: true, user: safeUser });
});

// Update profile
router.put('/me', auth, async (req, res) => {
  const { name, storeName, city, language } = req.body;
  try {
    if (name) await db.query('UPDATE users SET name = $1 WHERE id = $2', [name, req.user.id]);
    if (storeName || city || language) {
      const updates = [];
      const vals = [];
      let i = 1;
      if (storeName) { updates.push(`name = $${i++}`); vals.push(storeName); }
      if (city) { updates.push(`city = $${i++}`); vals.push(city); }
      if (language) { updates.push(`language = $${i++}`); vals.push(language); }
      vals.push(req.storeId);
      await db.query(`UPDATE stores SET ${updates.join(', ')} WHERE id = $${i}`, vals);
    }
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
