# Stocksense Ultra Pro (Backend)

## Setup

```bash
npm install
```

Create `.env` (see `.env.example`), then run:

```bash
npm run dev
```

Server defaults to `http://localhost:8787`.

## Layer 1 endpoints (initial)

- `GET /health`
- `GET /api/layer1/nse/indices` (India VIX, NIFTY 50, etc.)
- `GET /api/layer1/nse/advances-declines`
- `GET /api/layer1/global/quotes` (NASDAQ/Nikkei/Hang Seng, USDINR, Crude)

