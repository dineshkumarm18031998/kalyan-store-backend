const jwt = require('jsonwebtoken');
const db = require('../db');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query(
      'SELECT u.*, s.name as store_name, s.currency, s.language FROM users u JOIN stores s ON u.store_id = s.id WHERE u.id = $1 AND u.is_active = true',
      [decoded.userId]
    );

    if (!result.rows[0]) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = result.rows[0];
    req.storeId = result.rows[0].store_id;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = auth;
