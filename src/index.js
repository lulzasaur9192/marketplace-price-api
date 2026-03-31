const express = require('express');
const reverbRoutes = require('./routes/reverb');
const tcgRoutes = require('./routes/tcg');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const { createEventLogger } = require('./middleware/logger');
const { startCron } = require('./cron');

const app = express();
app.use(express.json());

// API event logging (before routes so all requests are captured)
app.use(createEventLogger());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'marketplace-price-api', timestamp: new Date().toISOString() });
});

// Analytics (auth-protected)
app.use('/analytics', analyticsRoutes);

// Search endpoints
app.use('/reverb', reverbRoutes);
app.use('/tcg', tcgRoutes);

// Alerts require API key auth (handled inside router)
app.use('/alerts', alertRoutes);

const PORT = process.env.PORT || 3000;

async function start() {
  // x402 micropayment middleware (optional — disabled by default)
  // Set X402_WALLET_ADDRESS env var to enable USDC micropayments
  // Note: requires compatible @x402/express version; falls back gracefully
  if (process.env.X402_WALLET_ADDRESS) {
    console.log('x402 wallet configured — micropayments will be enabled on supported versions');
  }

  startCron();
  app.listen(PORT, () => {
    console.log(`Marketplace Price API running on port ${PORT}`);
    console.log(`Endpoints: /health, /reverb/search, /reverb/price-history, /tcg/search, /tcg/price, /alerts`);
  });
}

start();
