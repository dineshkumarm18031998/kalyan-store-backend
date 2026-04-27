const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get all products with available stock
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*,
        COALESCE((
          SELECT SUM(oi.quantity - oi.returned_qty)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id
            AND o.store_id = p.store_id
            AND o.status IN ('active', 'partial')
        ), 0) AS rented_qty,
        p.total_qty - COALESCE((
          SELECT SUM(oi.quantity - oi.returned_qty)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id
            AND o.store_id = p.store_id
            AND o.status IN ('active', 'partial')
        ), 0) AS available_qty
      FROM products p
      WHERE p.store_id = $1 AND p.is_active = true
      ORDER BY p.created_at DESC
    `, [req.storeId]);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// Get available stock for date range
router.post('/availability', auth, async (req, res) => {
  const { fromDate, toDate, excludeOrderId } = req.body;
  try {
    const result = await db.query(`
      SELECT p.id, p.name, p.emoji, p.total_qty,
        p.total_qty - COALESCE((
          SELECT SUM(oi.quantity - oi.returned_qty)
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.product_id = p.id
            AND o.store_id = p.store_id
            AND o.status IN ('active', 'partial')
            AND o.id != COALESCE($3, -1)
            AND (o.from_date, COALESCE(o.to_date, o.from_date + interval '30 days'))
                OVERLAPS ($1::date, $2::date)
        ), 0) AS available_qty
      FROM products p
      WHERE p.store_id = $4 AND p.is_active = true
      ORDER BY p.name
    `, [fromDate, toDate || fromDate, excludeOrderId || null, req.storeId]);
    res.json({ success: true, availability: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// Add product — supports image_url (base64 or URL)
router.post('/', auth, async (req, res) => {
  const { name, nameTa, category, emoji, totalQty, ratePerDay, description, imageUri } = req.body;
  if (!name || !totalQty || !ratePerDay)
    return res.status(400).json({ success: false, message: 'Name, quantity and rate required' });
  try {
    const result = await db.query(
      'INSERT INTO products (store_id, name, name_ta, category, emoji, total_qty, rate_per_day, description, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [req.storeId, name, nameTa || null, category || 'other', emoji || '📦', totalQty, ratePerDay, description || null, imageUri || null]
    );
    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add product' });
  }
});

// Update product — supports image_url
router.put('/:id', auth, async (req, res) => {
  const { name, nameTa, category, emoji, totalQty, ratePerDay, description, imageUri } = req.body;
  try {
    // Only update image_url if imageUri is explicitly provided (non-null)
    const imageUpdate = imageUri !== undefined ? `, image_url=$10` : '';
    const params = [name, nameTa || null, category || 'other', emoji || '📦', totalQty, ratePerDay, description || null, req.params.id, req.storeId];
    if (imageUri !== undefined) params.push(imageUri);

    const result = await db.query(
      `UPDATE products SET name=$1, name_ta=$2, category=$3, emoji=$4, total_qty=$5, rate_per_day=$6, description=$7, updated_at=NOW()${imageUpdate}
       WHERE id=$8 AND store_id=$9 RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
});

// Delete product (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active = false WHERE id = $1 AND store_id = $2', [req.params.id, req.storeId]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;
