const { Router } = require('express');
const { searchReverb, computePriceStats } = require('../apify');

const router = Router();

// Endpoint metadata for instrumentation & GTM tagging
const endpoints = {
  search: {
    group: 'lookup',
    description: 'Search Reverb for musical instruments by name, price range, and condition',
    costCategorization: 'search_operation'
  },
  priceHistory: {
    group: 'historical',
    description: 'Get price history and statistics for musical instruments on Reverb',
    costCategorization: 'aggregation_operation'
  }
};

// GET /reverb/search?q=fender+stratocaster&maxPrice=500&condition=good
router.get('/search', async (req, res) => {
  const { q, maxPrice, minPrice, condition, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  try {
    const items = await searchReverb({
      query: q,
      maxPrice,
      minPrice,
      condition,
      maxListings: Number(limit) || 25,
    });

    const results = items.map(i => ({
      listingId: i.listingId,
      title: i.title,
      make: i.make,
      model: i.model,
      price: i.price,
      currency: i.priceCurrency,
      condition: i.condition,
      shopName: i.shopName,
      url: i.url,
      imageUrl: i.photos?.[0]?.url || null,
      publishedAt: i.publishedAt,
    }));

    res.json({
      marketplace: 'reverb',
      endpoint_group: endpoints.search.group,
      query: q,
      count: results.length,
      results
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

// GET /reverb/price-history?q=fender+stratocaster
router.get('/price-history', async (req, res) => {
  const { q, condition, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  try {
    const items = await searchReverb({
      query: q,
      condition,
      maxListings: Number(limit) || 50,
    });

    const stats = computePriceStats(items, 'price');

    res.json({
      marketplace: 'reverb',
      endpoint_group: endpoints.priceHistory.group,
      query: q,
      priceStats: stats,
      sampleListings: items.slice(0, 5).map(i => ({
        title: i.title,
        price: i.price,
        condition: i.condition,
        publishedAt: i.publishedAt,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

// Export endpoint metadata for API documentation
router.getEndpointMetadata = () => endpoints;

module.exports = router;
