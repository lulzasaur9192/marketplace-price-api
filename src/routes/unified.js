const { Router } = require('express');
const { searchReverb, searchTCG, searchOfferUp, searchPoshmark, computePriceStats } = require('../apify');

const router = Router();

// Normalize results from different marketplaces into a common format
function normalizeReverb(items) {
  return items.map(i => ({
    marketplace: 'reverb',
    title: i.title,
    price: parseFloat(i.price || 0),
    condition: i.condition,
    url: i.url,
    imageUrl: i.photos?.[0]?.url || null,
  }));
}

function normalizeTCG(items) {
  return items.map(i => ({
    marketplace: 'tcgplayer',
    title: i.productName || i.name,
    price: parseFloat(i.marketPrice || i.lowestPrice || 0),
    condition: i.condition,
    url: i.url,
    imageUrl: i.imageUrl || null,
  }));
}

function normalizeOfferUp(items) {
  return items.map(i => ({
    marketplace: 'offerup',
    title: i.title || i.name,
    price: parseFloat(i.price || 0),
    condition: i.condition,
    url: i.url,
    imageUrl: i.imageUrl || i.photos?.[0] || null,
  }));
}

function normalizePoshmark(items) {
  return items.map(i => ({
    marketplace: 'poshmark',
    title: i.title || i.name,
    price: parseFloat(i.price || 0),
    condition: i.condition,
    url: i.url,
    imageUrl: i.imageUrl || i.coverPhoto || null,
  }));
}

// GET /search?q=fender+stratocaster&marketplaces=reverb,tcg,offerup,poshmark&limit=10
router.get('/', async (req, res) => {
  const { q, marketplaces, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const maxListings = Number(limit) || 10;
  const requested = marketplaces
    ? marketplaces.split(',').map(m => m.trim().toLowerCase())
    : ['reverb', 'tcg', 'offerup', 'poshmark'];

  const searches = [];
  const labels = [];

  if (requested.includes('reverb')) {
    searches.push(searchReverb({ query: q, maxListings }).then(normalizeReverb).catch(() => []));
    labels.push('reverb');
  }
  if (requested.includes('tcg') || requested.includes('tcgplayer')) {
    searches.push(searchTCG({ query: q, maxListings }).then(normalizeTCG).catch(() => []));
    labels.push('tcgplayer');
  }
  if (requested.includes('offerup')) {
    searches.push(searchOfferUp({ query: q, maxListings }).then(normalizeOfferUp).catch(() => []));
    labels.push('offerup');
  }
  if (requested.includes('poshmark')) {
    searches.push(searchPoshmark({ query: q, maxListings }).then(normalizePoshmark).catch(() => []));
    labels.push('poshmark');
  }

  if (searches.length === 0) {
    return res.status(400).json({ error: 'No valid marketplaces specified. Options: reverb, tcg, offerup, poshmark' });
  }

  try {
    const results = await Promise.all(searches);
    const allListings = results.flat().filter(item => item.price > 0);
    allListings.sort((a, b) => a.price - b.price);

    const stats = computePriceStats(allListings, 'price');

    const byMarketplace = {};
    for (const label of labels) {
      const items = allListings.filter(i => i.marketplace === label);
      byMarketplace[label] = { count: items.length, avgPrice: items.length > 0 ? Math.round(items.reduce((s, i) => s + i.price, 0) / items.length * 100) / 100 : null };
    }

    res.json({
      query: q,
      marketplaces: labels,
      totalResults: allListings.length,
      priceStats: stats,
      byMarketplace,
      results: allListings,
    });
  } catch (err) {
    res.status(502).json({ error: 'Search error', message: err.message });
  }
});

module.exports = router;
