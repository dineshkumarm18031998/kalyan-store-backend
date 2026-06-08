const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { storeId: req.storeId }, orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch products', details: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, totalQty, rentPerDay, category, image } = req.body;
    if (!name || !totalQty || !rentPerDay) return res.status(400).json({ error: 'Name, quantity and rent required' });
    const product = await prisma.product.create({
      data: { name, totalQty: parseInt(totalQty), rentPerDay: parseFloat(rentPerDay), category: category || null, image, storeId: req.storeId }
    });
    res.json(product);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create product' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, totalQty, rentPerDay, category, image } = req.body;
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.storeId !== req.storeId) return res.status(404).json({ error: 'Product not found' });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { name, totalQty: parseInt(totalQty), rentPerDay: parseFloat(rentPerDay), category: category || null, ...(image && { image }) }
    });
    res.json(product);
  } catch (err) { res.status(500).json({ error: 'Failed to update product' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try { 
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.storeId !== req.storeId) return res.status(404).json({ error: 'Product not found' });
    await prisma.product.delete({ where: { id: req.params.id } }); 
    res.json({ success: true }); 
  }
  catch (err) { res.status(500).json({ error: 'Failed to delete product' }); }
});

module.exports = router;
