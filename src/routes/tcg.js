const { Router } = require('express');
const { searchTCG, computePriceStats } = require('../apify');

const router = Router();

// Endpoint metadata for instrumentation & GTM tagging
const endpoints = {
  search: {
    group: 'lookup',
    description: 'Search TCGPlayer for cards by name, set, or condition',
    costCategorization: 'search_operation'
  },
  price: {
    group: 'bulk_pricing',
    description: 'Get price statistics for multiple TCGPlayer listings',
    costCategorization: 'aggregation_operation'
  }
};

// GET /tcg/search?q=black+lotus&set=alpha&condition=nm
router.get('/search', async (req, res) => {
  const { q, productLine, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  try {
    const items = await searchTCG({
      query: q,
      productLine,
      maxListings: Number(limit) || 25,
    });

    const results = items.map(i => ({
      productId: i.productId,
      name: i.productName,
      productLine: i.productLineName,
      setName: i.setName,
      rarity: i.rarityName,
      cardNumber: i.cardNumber,
      marketPrice: i.marketPrice,
      medianPrice: i.medianPrice,
      lowestPrice: i.lowestPrice,
      lowestPriceWithShipping: i.lowestPriceWithShipping,
      totalListings: i.totalListings,
      imageUrl: i.imageUrl,
      url: i.url,
    }));

    // Add endpoint metadata for instrumentation
    res.json({
      marketplace: 'tcgplayer',
      endpoint_group: endpoints.search.group,
      query: q,
      count: results.length,
      results
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

// GET /tcg/price?cardName=black+lotus&set=alpha
router.get('/price', async (req, res) => {
  const { cardName, productLine, limit } = req.query;
  if (!cardName) return res.status(400).json({ error: 'cardName parameter required' });

  try {
    const items = await searchTCG({
      query: cardName,
      productLine,
      maxListings: Number(limit) || 25,
    });

    const stats = computePriceStats(items, 'marketPrice');
    const lowestStats = computePriceStats(items, 'lowestPrice');

    res.json({
      marketplace: 'tcgplayer',
      endpoint_group: endpoints.price.group,
      cardName,
      marketPriceStats: stats,
      lowestPriceStats: lowestStats,
      sampleCards: items.slice(0, 5).map(i => ({
        name: i.productName,
        set: i.setName,
        rarity: i.rarityName,
        marketPrice: i.marketPrice,
        lowestPrice: i.lowestPrice,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: 'Scraper error', message: err.message });
  }
});

// Export endpoint metadata for API documentation
router.getEndpointMetadata = () => endpoints;

module.exports = router;
