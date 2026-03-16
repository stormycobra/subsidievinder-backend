if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const logger = require('./services/logger');
const startup = require('./startup');

const authRoutes = require('./routes/auth');
const subsidieRoutes = require('./routes/subsidies');
const alertRoutes = require('./routes/alerts');
const aiRoutes = require('./routes/ai');
const { runDailyCheck } = require('./services/alertService');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security ─────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50kb' }));

// ─── Rate limiting ─────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Te veel verzoeken. Probeer over 15 minuten opnieuw.' },
}));
app.use('/api/ai/', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI-limiet bereikt. Wacht even en probeer opnieuw.' },
}));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/subsidies', subsidieRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Er is een serverfout opgetreden.' : err.message,
  });
});

// ─── Cron: dagelijks 08:00 ────────────────────────────────
cron.schedule('0 8 * * *', async () => {
  logger.info('Cron: dagelijkse alert-check');
  await runDailyCheck();
}, { timezone: 'Europe/Amsterdam' });

// ─── Start ────────────────────────────────────────────────
async function main() {
  await startup(); // auto-migratie + seed bij eerste keer
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`SubsidieVinder backend draait op poort ${PORT}`);
  });
}

main().catch(err => {
  console.error('Server start mislukt:', err);
  process.exit(1);
});

module.exports = app;
