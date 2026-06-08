const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all bookings for store
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { storeId: req.storeId, isDeleted: false },
      include: { items: true, damages: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get single booking
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id, isDeleted: false },
      include: { items: true, damages: true }
    });
    if (!booking || booking.storeId !== req.storeId) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    const { cName, cMob, cAddr, notes, eventType, startDate, items, paidAmount, isVip, generatedBy } = req.body;
    if (!cName || !cMob || !items?.length) {
      return res.status(400).json({ error: 'Customer name, mobile and items required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const adv = parseFloat(paidAmount) || 0;

    const booking = await prisma.booking.create({
      data: {
        date: today,
        cName,
        cMob,
        cAddr,
        notes,
        eventType,
        startDate: startDate || today,
        paidAmount: adv,
        paid: false, // Initially false, will be calculated properly on bill generation
        isVip: isVip || false,
        generatedBy: generatedBy || null,
        storeId: req.storeId,
        items: {
          create: items.map(i => ({
            name: i.name,
            qty: parseInt(i.qty),
            rate: parseFloat(i.rate),
            deposit: parseFloat(i.deposit) || 0,
            image: i.image || null
          }))
        }
      },
      include: { items: true, damages: true }
    });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking (return date, payment, etc)
router.put('/:id', auth, async (req, res) => {
  try {
    const { returnDate, totalDays, subtotal, discount, totalAmount, paid, paidAmount, returned, actualReturnDate, isVip, generatedBy, advanceReturned } = req.body;

    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.storeId !== req.storeId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        ...(returnDate !== undefined && { returnDate }),
        ...(totalDays !== undefined && { totalDays: parseInt(totalDays) }),
        ...(subtotal !== undefined && { subtotal: parseFloat(subtotal) }),
        ...(discount !== undefined && { discount: parseFloat(discount) }),
        ...(totalAmount !== undefined && { totalAmount: parseFloat(totalAmount) }),
        ...(paid !== undefined && { paid }),
        ...(paidAmount !== undefined && { paidAmount: parseFloat(paidAmount) }),
        ...(returned !== undefined && { returned }),
        ...(actualReturnDate !== undefined && { actualReturnDate }),
        ...(isVip !== undefined && { isVip }),
        ...(generatedBy !== undefined && { generatedBy }),
        ...(advanceReturned !== undefined && { advanceReturned })
      },
      include: { items: true, damages: true }
    });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.storeId !== req.storeId) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
      include: { items: true, damages: true }
    });
    res.json({ success: true, booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

module.exports = router;
