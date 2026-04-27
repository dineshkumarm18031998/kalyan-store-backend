require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const db         = require('./db');

const app  = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 20,  message: 'Too many attempts' }));
app.use('/api',      rateLimit({ windowMs: 15*60*1000, max: 500 }));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/stats',     require('./routes/dashboard'));
app.use('/api/customers',   require('./routes/customers'));
app.use('/api/signatures',  require('./routes/signatures'));

// Health check — MUST return plain text "OK" to avoid cron-job.org "output too large" error
// cron-job.org pings this every 14 min to keep free-tier server alive
app.get('/health',     (req, res) => res.status(200).type('text/plain').send('OK'));
app.get('/api/health', (req, res) => res.status(200).type('text/plain').send('OK'));
app.get('/', (req, res) => res.json({ message: 'Kalyan Store API running', version: '1.0.0' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Kalyan Store API running on port ${PORT}`));
module.exports = app;
