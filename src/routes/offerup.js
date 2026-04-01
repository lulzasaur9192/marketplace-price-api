const { Router } = require('express');
const { searchOfferUp, computePriceStats } = require('../apify');

const router = Router();

// GET /offerup/search?q=iphone+14&maxPrice=500&location=los+angeles
router.get('/search', async (req, res) => {
  const { q, maxPrice, location, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  try {
    const items = await searchOfferUp({
      query: q,
      maxListings: Number(limit) || 25,
      location,
      maxPrice,
    });

    const results = items.map(i => ({
      title: i.title || i.name,
      price: parseFloat(i.price || 0),
      condition: i.condition,
      location: i.location,
      url: i.url,
      imageUrl: i.imageUrl || i.photos?.[0] || null,
      postedAt: i.postedAt || i.publishedAt,
    }));

    res.json({
      marketplace: 'offerup',
      query: q,
      count: results.length,
      results,
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

module.exports = router;
