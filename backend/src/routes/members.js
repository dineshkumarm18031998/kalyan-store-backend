const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const auth = require('../middleware/auth');

// Get all members for the store
router.get('/', auth, async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { storeId: req.storeId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Create a new member
router.post('/', auth, async (req, res) => {
  try {
    const { name, signature } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const count = await prisma.member.count({ where: { storeId: req.storeId } });
    if (count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 members allowed per store' });
    }

    const member = await prisma.member.create({
      data: {
        name,
        signature,
        storeId: req.storeId
      }
    });

    res.status(201).json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update a member
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, signature } = req.body;
    
    // Check if member belongs to store
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!member || member.storeId !== req.storeId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updated = await prisma.member.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(signature !== undefined && { signature })
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete a member
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if member belongs to store
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!member || member.storeId !== req.storeId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.member.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

module.exports = router;
