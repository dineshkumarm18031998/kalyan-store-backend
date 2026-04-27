const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let q = 'SELECT * FROM customers WHERE store_id=$1';
    const params = [req.storeId];
    if (search) { q += ' AND (name ILIKE $2 OR phone ILIKE $2)'; params.push(`%${search}%`); }
    q += ' ORDER BY total_revenue DESC';
    const result = await db.query(q, params);
    res.json({ success: true, customers: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/:id/orders', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM orders WHERE customer_id=$1 AND store_id=$2 ORDER BY created_at DESC',
      [req.params.id, req.storeId]
    );
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { name, phone, address, isVip, notes } = req.body;
  try {
    const result = await db.query(
      'UPDATE customers SET name=$1, phone=$2, address=$3, is_vip=$4, notes=$5 WHERE id=$6 AND store_id=$7 RETURNING *',
      [name, phone, address, isVip, notes, req.params.id, req.storeId]
    );
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
