require('dotenv').config();
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const bookingRoutes = require('./routes/bookings');
const damageRoutes = require('./routes/damages');
const memberRoutes = require('./routes/members');

const prisma = require('./prisma');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Kalyan Store API Running 🏪' });
});

// Force Database Sync endpoint
app.get('/api/db-push', (req, res) => {
  try {
    const output = execSync('npx prisma db push --accept-data-loss').toString();
    res.json({ status: 'success', message: 'Database schema successfully synchronized!', output });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message, output: error.stdout?.toString() });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/damages', damageRoutes);
app.use('/api/members', memberRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏪 Kalyan Store API running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
