const { Router } = require('express');
const { searchPoshmark, computePriceStats } = require('../apify');

const router = Router();

// GET /poshmark/search?q=nike+air+max&maxPrice=100
router.get('/search', async (req, res) => {
  const { q, maxPrice, sortBy, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  try {
    const items = await searchPoshmark({
      query: q,
      maxListings: Number(limit) || 25,
      maxPrice,
      sortBy,
    });

    const results = items.map(i => ({
      title: i.title || i.name,
      price: parseFloat(i.price || 0),
      originalPrice: parseFloat(i.originalPrice || 0),
      size: i.size,
      brand: i.brand,
      condition: i.condition,
      url: i.url,
      imageUrl: i.imageUrl || i.coverPhoto || null,
    }));

    res.json({
      marketplace: 'poshmark',
      query: q,
      count: results.length,
      results,
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

module.exports = router;
