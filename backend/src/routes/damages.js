const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// Add damage to booking
router.post('/:bookingId', auth, async (req, res) => {
  try {
    const { product, qty, rate } = req.body;
    if (!product || !qty || !rate) {
      return res.status(400).json({ error: 'Product, qty and rate required' });
    }

    const damage = await prisma.damage.create({
      data: {
        product,
        qty: parseInt(qty),
        rate: parseFloat(rate),
        bookingId: req.params.bookingId
      }
    });

    // Recalculate booking total
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { items: true, damages: true }
    });

    if (booking && booking.storeId === req.storeId) {
      const days = booking.totalDays > 0 ? booking.totalDays : 1;
      const itemsTotal = booking.items.reduce((s, i) => s + i.qty * i.rate * days, 0);
      const dmgTotal = booking.damages.reduce((s, d) => s + d.qty * d.rate, 0);
      const newTotal = Math.max(0, itemsTotal - booking.discount) + dmgTotal;

      await prisma.booking.update({
        where: { id: req.params.bookingId },
        data: { totalAmount: newTotal }
      });
    }

    res.json(damage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add damage' });
  }
});

// Delete damage
router.delete('/:id', auth, async (req, res) => {
  try {
    const damage = await prisma.damage.findUnique({ where: { id: req.params.id } });
    if (!damage) return res.status(404).json({ error: 'Damage not found' });

    await prisma.damage.delete({ where: { id: req.params.id } });

    // Recalculate booking total
    const booking = await prisma.booking.findUnique({
      where: { id: damage.bookingId },
      include: { items: true, damages: true }
    });

    if (booking && booking.storeId === req.storeId) {
      const days = booking.totalDays > 0 ? booking.totalDays : 1;
      const itemsTotal = booking.items.reduce((s, i) => s + i.qty * i.rate * days, 0);
      const dmgTotal = booking.damages.reduce((s, d) => s + d.qty * d.rate, 0);
      const newTotal = Math.max(0, itemsTotal - booking.discount) + dmgTotal;

      await prisma.booking.update({
        where: { id: damage.bookingId },
        data: { totalAmount: newTotal }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete damage' });
  }
});

module.exports = router;
