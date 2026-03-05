# Alpha Engine — Quantitative Trading Dashboard

A full-stack portfolio optimization and trading dashboard built with **FastAPI** and **React**.

Uses real historical stock data from Yahoo Finance and optimizes portfolio allocations by maximizing the **Sharpe Ratio** using scipy's SLSQP solver (adapted from CS 4646/7646 coursework).

![Dashboard Preview](docs/preview.png)

---

## Features

- **Portfolio Optimization** — Finds optimal asset weights that maximize Sharpe Ratio
- **Real Market Data** — Fetches adjusted close prices from Yahoo Finance
- **Equity Curve** — Portfolio vs S&P 500 benchmark over time
- **Simulated Trade Feed** — Realistic trade data based on optimized holdings
- **Performance Metrics** — Sharpe ratio, max drawdown, win rate, profit factor
- **Interactive Config** — Change symbols and date ranges from the UI

---

## Project Structure

```
trading-app/
├── backend/
│   ├── main.py              # FastAPI server & endpoints
│   ├── optimizer.py          # Portfolio optimization (adapted from optimization.py)
│   ├── simulator.py          # Simulated trade generator
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js        # Vite config with API proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx          # React entry point
│       └── TradingDashboard.jsx  # Full dashboard component
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The API will start at **http://localhost:8000**.  
Interactive docs at **http://localhost:8000/docs**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will open at **http://localhost:5173**.  
Vite proxies `/api/*` requests to the backend automatically.

---

## API Endpoints

| Method | Endpoint           | Description                        |
|--------|--------------------|------------------------------------|
| GET    | `/api/portfolio`   | Full optimization result           |
| GET    | `/api/equity-curve`| Equity curve data points           |
| GET    | `/api/metrics`     | Performance stats & allocations    |
| GET    | `/api/trades`      | Simulated trade feed + session stats|
| GET    | `/api/health`      | Health check                       |

**Common query parameters:**  
- `symbols` — Comma-separated ticker symbols (default: `AAPL,MSFT,GOOGL,NVDA,AMZN,META`)  
- `start` — Start date as `YYYY-MM-DD` (default: `2023-01-01`)  
- `end` — End date as `YYYY-MM-DD` (default: `2024-01-01`)

Example:
```
GET /api/portfolio?symbols=AAPL,MSFT,GLD,XOM&start=2022-01-01&end=2023-01-01
```

---

## How the Optimization Works

1. **Fetch** adjusted close prices from Yahoo Finance for the given symbols and date range
2. **Normalize** prices to day-1 base values
3. **Define objective**: minimize negative annualized Sharpe Ratio → `−√252 × (μ_daily / σ_daily)`
4. **Solve** using scipy SLSQP with constraints: all weights in [0, 1], weights sum to 1.0
5. **Compute** equity curve, monthly returns, drawdowns, and portfolio statistics

---

## Tech Stack

**Backend:** Python, FastAPI, numpy, pandas, scipy, yfinance  
**Frontend:** React 18, Recharts, Vite  
**Design:** Dark terminal aesthetic, JetBrains Mono + DM Sans typography
