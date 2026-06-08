const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = require('../prisma');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { storeName, ownerName, mobile, password, address, lang } = req.body;

    if (!storeName || !ownerName || !mobile || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const exists = await prisma.store.findUnique({ where: { mobile } });
    if (exists) return res.status(400).json({ error: 'Mobile already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const store = await prisma.store.create({
      data: { storeName, ownerName, mobile, password: hashedPassword, address, lang: lang || 'en' }
    });

    const token = jwt.sign(
      { storeId: store.id, storeName: store.storeName, ownerName: store.ownerName, mobile: store.mobile, lang: store.lang },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    res.json({
      token,
      store: { id: store.id, storeName: store.storeName, ownerName: store.ownerName, mobile: store.mobile, address: store.address, lang: store.lang, createdBy: store.createdBy, createdBySignature: store.createdBySignature }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const store = await prisma.store.findUnique({ where: { mobile } });
    if (!store) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, store.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { storeId: store.id, storeName: store.storeName, ownerName: store.ownerName, mobile: store.mobile, lang: store.lang },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    res.json({
      token,
      store: { id: store.id, storeName: store.storeName, ownerName: store.ownerName, mobile: store.mobile, address: store.address, lang: store.lang, createdBy: store.createdBy, createdBySignature: store.createdBySignature }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update Profile
const auth = require('../middleware/auth');
router.put('/profile', auth, async (req, res) => {
  try {
    const { createdBy, createdBySignature, storeName, address, lang } = req.body;
    const store = await prisma.store.update({
      where: { id: req.storeId },
      data: {
        ...(createdBy !== undefined && { createdBy }),
        ...(createdBySignature !== undefined && { createdBySignature }),
        ...(storeName !== undefined && { storeName }),
        ...(address !== undefined && { address }),
        ...(lang !== undefined && { lang })
      }
    });
    res.json({
      store: { id: store.id, storeName: store.storeName, ownerName: store.ownerName, mobile: store.mobile, address: store.address, lang: store.lang, createdBy: store.createdBy, createdBySignature: store.createdBySignature }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
