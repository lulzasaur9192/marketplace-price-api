const crypto = require('crypto');
const { getCache, setCache } = require('./db');

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const BASE = 'https://api.apify.com/v2';

const CACHE_TTL = {
  reverb: 7200,    // 2 hours
  tcg: 14400,      // 4 hours
  offerup: 3600,   // 1 hour
  poshmark: 7200,  // 2 hours
};

function makeCacheKey(marketplace, params) {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return `${marketplace}:${crypto.createHash('md5').update(sorted).digest('hex')}`;
}

async function runActor(actorId, input, timeoutSecs = 120) {
  const url = `${BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${timeoutSecs}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify error ${res.status}: ${text}`);
  }
  return res.json();
}

async function searchReverb({ query, maxPrice, minPrice, condition, maxListings = 25 }) {
  const params = { query, maxPrice, minPrice, condition, maxListings };
  const key = makeCacheKey('reverb', params);
  const cached = getCache(key);
  if (cached) return cached;

  const input = {
    searchQueries: [query],
    maxListings,
  };
  if (maxPrice) input.maxPrice = Number(maxPrice);
  if (minPrice) input.minPrice = Number(minPrice);
  if (condition) input.condition = condition;

  const results = await runActor('TrMcLws2pAsIrKCyu', input);
  setCache(key, 'reverb', query, results, CACHE_TTL.reverb);
  return results;
}

async function searchTCG({ query, productLine, maxListings = 25 }) {
  const params = { query, productLine, maxListings };
  const key = makeCacheKey('tcg', params);
  const cached = getCache(key);
  if (cached) return cached;

  const input = {
    searchQueries: [query],
    maxListings,
  };
  if (productLine) input.productLine = productLine;

  const results = await runActor('O0sgde2LgujyWHvNt', input);
  setCache(key, 'tcg', query, results, CACHE_TTL.tcg);
  return results;
}

function computePriceStats(items, priceField) {
  const prices = items.map(i => i[priceField]).filter(p => typeof p === 'number' && p > 0);
  if (prices.length === 0) return { min: null, max: null, avg: null, median: null, count: 0 };
  prices.sort((a, b) => a - b);
  const sum = prices.reduce((a, b) => a + b, 0);
  const mid = Math.floor(prices.length / 2);
  return {
    min: prices[0],
    max: prices[prices.length - 1],
    avg: Math.round((sum / prices.length) * 100) / 100,
    median: prices.length % 2 ? prices[mid] : Math.round(((prices[mid - 1] + prices[mid]) / 2) * 100) / 100,
    count: prices.length,
  };
}

async function searchOfferUp({ query, maxListings = 25, location, maxPrice }) {
  const params = { query, maxListings, location, maxPrice };
  const key = makeCacheKey('offerup', params);
  const cached = getCache(key);
  if (cached) return cached;

  const input = {
    searchQueries: [query],
    maxListings,
  };
  if (location) input.location = location;
  if (maxPrice) input.maxPrice = Number(maxPrice);

  const results = await runActor('3ToUCWqZR2B2j3xxz', input);
  setCache(key, 'offerup', query, results, CACHE_TTL.offerup);
  return results;
}

async function searchPoshmark({ query, maxListings = 25, maxPrice, sortBy }) {
  const params = { query, maxListings, maxPrice, sortBy };
  const key = makeCacheKey('poshmark', params);
  const cached = getCache(key);
  if (cached) return cached;

  const input = {
    searchQueries: [query],
    maxListings,
  };
  if (maxPrice) input.maxPrice = Number(maxPrice);
  if (sortBy) input.sortBy = sortBy;

  const results = await runActor('eBAEtlRiRwdkrJOwk', input);
  setCache(key, 'poshmark', query, results, CACHE_TTL.poshmark);
  return results;
}

module.exports = { searchReverb, searchTCG, searchOfferUp, searchPoshmark, computePriceStats };
