const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify store actually exists in DB to prevent foreign key errors with old tokens
    const storeExists = await prisma.store.findUnique({
      where: { id: decoded.storeId },
      select: { id: true }
    });
    
    if (!storeExists) {
      return res.status(401).json({ error: 'Store no longer exists' });
    }

    req.storeId = decoded.storeId;
    req.store = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;
