# Marketplace Price API — Deployment Guide

## Local Development

```bash
cd projects/marketplace-price-api
npm install
APIFY_TOKEN=$(cat ~/.apify_token) API_KEY=$(uuidgen) node src/index.js
```

Test: `curl http://localhost:3000/health`

## Railway Deployment

1. Push to GitHub or connect directory
2. Create new Railway project
3. Set environment variables:
   - `APIFY_TOKEN` — your Apify API token
   - `API_KEY` — generate with `uuidgen` (master key for alert management)
   - `PORT` — 3000 (Railway sets this automatically)
   - `X402_WALLET_ADDRESS` — (optional) USDC wallet for x402 micropayments
4. Deploy — Railway auto-detects the Dockerfile

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_TOKEN` | Yes | Apify API token for running scrapers |
| `API_KEY` | Yes | Master API key for alert management |
| `PORT` | No | Server port (default: 3000) |
| `X402_WALLET_ADDRESS` | No | Enable x402 USDC micropayments |
| `X402_NETWORK` | No | Default: base-mainnet |
| `X402_FACILITATOR_URL` | No | Default: https://facilitator.xpay.sh |

## Endpoints

- `GET /health` — health check
- `GET /reverb/search?q=...&maxPrice=...&condition=...` — search Reverb listings
- `GET /reverb/price-history?q=...` — price range stats for Reverb
- `GET /tcg/search?q=...&productLine=...` — search TCGPlayer cards
- `GET /tcg/price?cardName=...` — card price stats
- `POST /alerts` — create price alert (requires x-api-key header)
- `GET /alerts` — list alerts
- `GET /alerts/:id` — get alert
- `DELETE /alerts/:id` — cancel alert
