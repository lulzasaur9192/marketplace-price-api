const cron = require('node-cron');
const db = require('./db');
const { searchReverb, searchTCG } = require('./apify');

async function fireWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Webhook delivery failed for ${url}:`, err.message);
  }
}

async function checkAlert(alert) {
  try {
    let items;
    if (alert.marketplace === 'reverb') {
      items = await searchReverb({ query: alert.query, maxPrice: alert.max_price, maxListings: 10 });
    } else {
      items = await searchTCG({ query: alert.query, maxListings: 10 });
    }

    // Filter items below max_price
    const priceField = alert.marketplace === 'reverb' ? 'price' : 'lowestPrice';
    const matches = items.filter(i => typeof i[priceField] === 'number' && i[priceField] <= alert.max_price);

    db.prepare('UPDATE alerts SET last_checked = datetime("now"), updated_at = datetime("now") WHERE id = ?')
      .run(alert.id);

    if (matches.length > 0) {
      const payload = {
        alertId: alert.id,
        query: alert.query,
        marketplace: alert.marketplace,
        maxPrice: alert.max_price,
        matchCount: matches.length,
        matches: matches.slice(0, 5).map(i => {
          if (alert.marketplace === 'reverb') {
            return { title: i.title, price: i.price, url: i.url };
          }
          return { name: i.productName, price: i[priceField], url: i.url };
        }),
        checkedAt: new Date().toISOString(),
      };

      await fireWebhook(alert.webhook_url, payload);

      db.prepare('UPDATE alerts SET last_triggered = datetime("now"), updated_at = datetime("now") WHERE id = ?')
        .run(alert.id);

      console.log(`Alert ${alert.id}: ${matches.length} matches found, webhook fired`);
    } else {
      console.log(`Alert ${alert.id}: no matches below $${alert.max_price}`);
    }
  } catch (err) {
    console.error(`Alert ${alert.id} check failed:`, err.message);
  }
}

function startCron() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    const alerts = db.prepare('SELECT * FROM alerts WHERE active = 1').all();
    console.log(`Cron: checking ${alerts.length} active alerts`);

    // Process alerts sequentially to avoid hammering Apify
    for (const alert of alerts) {
      await checkAlert(alert);
    }
  });

  console.log('Alert cron started (every 30 min)');

  // Purge expired cache entries every hour
  cron.schedule('0 * * * *', () => {
    const deleted = db.purgeExpiredCache();
    if (deleted.changes > 0) console.log(`Cache cleanup: removed ${deleted.changes} expired entries`);
  });
}

module.exports = { startCron };
