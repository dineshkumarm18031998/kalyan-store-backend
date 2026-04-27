const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET all signatures for this store
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, image_base64, created_at FROM store_signatures WHERE store_id = $1 ORDER BY created_at ASC',
      [req.storeId]
    );
    res.json({ success: true, signatures: result.rows });
  } catch (err) {
    console.error('Get signatures error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch signatures' });
  }
});

// POST add a new signature (max 3 per store)
router.post('/', auth, async (req, res) => {
  const { name, imageBase64 } = req.body;
  if (!name || !imageBase64)
    return res.status(400).json({ success: false, message: 'Name and image required' });

  try {
    // Check count
    const countR = await db.query(
      'SELECT COUNT(*) FROM store_signatures WHERE store_id = $1',
      [req.storeId]
    );
    if (parseInt(countR.rows[0].count) >= 3)
      return res.status(400).json({ success: false, message: 'Maximum 3 signatures allowed' });

    const result = await db.query(
      'INSERT INTO store_signatures (store_id, name, image_base64) VALUES ($1, $2, $3) RETURNING id, name, image_base64, created_at',
      [req.storeId, name.trim(), imageBase64]
    );
    res.status(201).json({ success: true, signature: result.rows[0] });
  } catch (err) {
    console.error('Add signature error:', err);
    res.status(500).json({ success: false, message: 'Failed to save signature' });
  }
});

// PUT update a signature
router.put('/:id', auth, async (req, res) => {
  const { name, imageBase64 } = req.body;
  try {
    const updates = [];
    const vals    = [];
    let i = 1;
    if (name)        { updates.push(`name = $${i++}`);         vals.push(name.trim()); }
    if (imageBase64) { updates.push(`image_base64 = $${i++}`); vals.push(imageBase64); }
    if (!updates.length)
      return res.status(400).json({ success: false, message: 'Nothing to update' });

    vals.push(req.params.id, req.storeId);
    const result = await db.query(
      `UPDATE store_signatures SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} AND store_id = $${i+1} RETURNING id, name, image_base64, created_at`,
      vals
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Signature not found' });
    res.json({ success: true, signature: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update signature' });
  }
});

// DELETE a signature
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM store_signatures WHERE id = $1 AND store_id = $2',
      [req.params.id, req.storeId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete signature' });
  }
});

module.exports = router;
