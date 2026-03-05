"""
Alpha Engine — FastAPI Backend
Serves optimized portfolio data, trade feed, and performance metrics.
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import datetime as dt

from optimizer import optimize_portfolio
from simulator import generate_trades, compute_trade_stats

app = FastAPI(title="Alpha Engine API", version="1.0.0")

# Allow the React dev server to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory cache so we don't re-optimize on every request ─────────────────
_cache: dict = {}


def _get_portfolio(symbols: list[str], start: str, end: str) -> dict:
    key = f"{','.join(sorted(symbols))}|{start}|{end}"
    if key not in _cache:
        sd = dt.datetime.strptime(start, "%Y-%m-%d")
        ed = dt.datetime.strptime(end, "%Y-%m-%d")
        _cache[key] = optimize_portfolio(symbols, sd, ed)
    return _cache[key]


# ── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/api/portfolio")
def get_portfolio(
    symbols: str = Query(default="AAPL,MSFT,GOOGL,NVDA,AMZN,META", description="Comma-separated stock symbols"),
    start: str = Query(default="2023-01-01", description="Start date (YYYY-MM-DD)"),
    end: str = Query(default="2024-01-01", description="End date (YYYY-MM-DD)"),
):
    """Full portfolio optimization result: allocations, stats, equity curve, holdings."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = _get_portfolio(syms, start, end)
    return data


@app.get("/api/equity-curve")
def get_equity_curve(
    symbols: str = Query(default="AAPL,MSFT,GOOGL,NVDA,AMZN,META"),
    start: str = Query(default="2023-01-01"),
    end: str = Query(default="2024-01-01"),
):
    """Equity curve data points for charting."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = _get_portfolio(syms, start, end)
    return {"equity_curve": data["equity_curve"]}


@app.get("/api/metrics")
def get_metrics(
    symbols: str = Query(default="AAPL,MSFT,GOOGL,NVDA,AMZN,META"),
    start: str = Query(default="2023-01-01"),
    end: str = Query(default="2024-01-01"),
):
    """Portfolio performance metrics / KPIs."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = _get_portfolio(syms, start, end)
    return {
        "stats": data["stats"],
        "allocations": data["allocations"],
    }


@app.get("/api/trades")
def get_trades(
    symbols: str = Query(default="AAPL,MSFT,GOOGL,NVDA,AMZN,META"),
    start: str = Query(default="2023-01-01"),
    end: str = Query(default="2024-01-01"),
    count: int = Query(default=20, ge=1, le=100),
):
    """Simulated trade feed based on optimized holdings."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = _get_portfolio(syms, start, end)
    trades = generate_trades(data["holdings"], num_trades=count)
    stats = compute_trade_stats(trades)
    return {"trades": trades, "session_stats": stats}


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": dt.datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
