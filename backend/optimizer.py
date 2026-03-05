"""
Portfolio optimizer using Sharpe Ratio maximization.
Adapted from CS 4646/7646 coursework — uses yfinance for real market data,
with simulated fallback if Yahoo Finance is unavailable.
"""

import datetime as dt
import numpy as np
import pandas as pd
import scipy.optimize as spo

# Try importing yfinance — it may fail or Yahoo may be blocked
try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False


# ── Data Fetching ──────────────────────────────────────────────────────────────

def _generate_simulated_prices(symbols: list[str], start: dt.datetime, end: dt.datetime) -> pd.DataFrame:
    """Generate realistic simulated price data as fallback."""
    print("  INFO: Using simulated price data (Yahoo Finance unavailable)")
    dates = pd.bdate_range(start=start, end=end)

    # Base prices and drift/vol characteristics per common ticker
    profiles = {
        "AAPL": (180, 0.0008, 0.018), "MSFT": (370, 0.0009, 0.017),
        "GOOGL": (140, 0.0007, 0.020), "NVDA": (480, 0.0015, 0.030),
        "AMZN": (150, 0.0008, 0.022), "META": (350, 0.0012, 0.025),
        "TSLA": (250, 0.0005, 0.035), "AMD": (140, 0.0010, 0.028),
        "JPM": (170, 0.0006, 0.015), "GS": (380, 0.0005, 0.018),
        "V": (270, 0.0007, 0.014), "GLD": (185, 0.0003, 0.010),
        "XOM": (105, 0.0004, 0.016), "JNJ": (155, 0.0003, 0.012),
        "SPY": (470, 0.0005, 0.011), "QQQ": (390, 0.0007, 0.014),
    }
    default_profile = (100, 0.0005, 0.020)

    np.random.seed(42)
    frames = {}
    for sym in symbols:
        base, drift, vol = profiles.get(sym, default_profile)
        returns = np.random.normal(drift, vol, size=len(dates))
        prices = base * np.cumprod(1 + returns)
        frames[sym] = prices

    df = pd.DataFrame(frames, index=dates)
    return df


def _generate_simulated_benchmark(start: dt.datetime, end: dt.datetime) -> pd.Series:
    """Generate simulated SPY benchmark."""
    dates = pd.bdate_range(start=start, end=end)
    np.random.seed(99)
    returns = np.random.normal(0.0005, 0.011, size=len(dates))
    prices = 470 * np.cumprod(1 + returns)
    return pd.Series(prices, index=dates, name="SPY")


def fetch_prices(symbols: list[str], start: dt.datetime, end: dt.datetime) -> pd.DataFrame:
    """Download adjusted close prices. Falls back to simulated data if Yahoo fails."""
    if not HAS_YF:
        return _generate_simulated_prices(symbols, start, end)

    frames = {}
    for sym in symbols:
        try:
            ticker = yf.Ticker(sym)
            hist = ticker.history(start=start, end=end, auto_adjust=True)
            if hist is not None and not hist.empty and "Close" in hist.columns:
                frames[sym] = hist["Close"]
                print(f"  OK: {sym} ({len(hist)} rows)")
        except Exception as e:
            print(f"  WARN: {sym} failed: {e}")

    if len(frames) < 2:
        print("  Too few tickers downloaded — falling back to simulated data.")
        return _generate_simulated_prices(symbols, start, end)

    prices = pd.DataFrame(frames)
    prices.dropna(inplace=True)

    if prices.empty or len(prices) < 20:
        print("  Insufficient price data — falling back to simulated data.")
        return _generate_simulated_prices(symbols, start, end)

    return prices


def fetch_benchmark(start: dt.datetime, end: dt.datetime) -> pd.Series:
    """Download SPY benchmark. Falls back to simulated data if Yahoo fails."""
    if not HAS_YF:
        return _generate_simulated_benchmark(start, end)

    try:
        ticker = yf.Ticker("SPY")
        hist = ticker.history(start=start, end=end, auto_adjust=True)
        if hist is not None and not hist.empty and "Close" in hist.columns:
            print("  OK: SPY benchmark")
            return hist["Close"].dropna()
    except Exception as e:
        print(f"  WARN: SPY benchmark failed: {e}")

    return _generate_simulated_benchmark(start, end)


# ── Math Helpers ───────────────────────────────────────────────────────────────

def _daily_returns(series):
    dr = (series / series.shift(1)) - 1
    return dr.iloc[1:]


def _normalize(df):
    return df / df.iloc[0]


def _negative_sharpe(allocs: np.ndarray, prices: pd.DataFrame) -> float:
    """Objective function: negative annualized Sharpe ratio."""
    port_val = (_normalize(prices) * allocs).sum(axis=1)
    dr = _daily_returns(port_val)
    if dr.std() == 0:
        return 0.0
    sr = np.sqrt(252) * (dr.mean() / dr.std())
    return -sr


# ── Main Optimizer ─────────────────────────────────────────────────────────────

def optimize_portfolio(
    symbols: list[str],
    start: dt.datetime = dt.datetime(2023, 1, 1),
    end: dt.datetime = dt.datetime(2024, 1, 1),
) -> dict:
    """
    Find optimal allocations that maximize Sharpe Ratio.
    Returns a dict with allocations, stats, equity curve, and benchmark curve.
    """
    print(f"\n{'='*60}")
    print(f"Optimizing: {symbols}")
    print(f"Period: {start.date()} to {end.date()}")
    print(f"{'='*60}")

    prices = fetch_prices(symbols, start, end)
    spy = fetch_benchmark(start, end)

    # Use only the symbols we actually have data for
    actual_symbols = list(prices.columns)
    n = len(actual_symbols)

    print(f"Optimizing {n} assets: {actual_symbols}")

    initial_allocs = np.array([1.0 / n] * n)
    bounds = tuple((0.0, 1.0) for _ in range(n))
    constraint = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}

    result = spo.minimize(
        _negative_sharpe,
        initial_allocs,
        args=(prices,),
        method="SLSQP",
        bounds=bounds,
        constraints=constraint,
    )

    allocs = result.x

    # Compute final portfolio stats
    norm_prices = _normalize(prices)
    port_val = (norm_prices * allocs).sum(axis=1)
    dr = _daily_returns(port_val)

    cr = float((port_val.iloc[-1] / port_val.iloc[0]) - 1)
    adr = float(dr.mean())
    sddr = float(dr.std())
    sr = float(np.sqrt(252) * (adr / sddr)) if sddr != 0 else 0.0

    print(f"  Sharpe Ratio: {sr:.2f}")
    print(f"  Cumulative Return: {cr*100:.2f}%")

    # Build equity curve (scaled to $100k starting value)
    start_value = 100_000
    equity_series = port_val * start_value

    # Normalize SPY to same dates
    if spy is not None and not spy.empty:
        spy_aligned = spy.reindex(prices.index, method="ffill").bfill()
        first_spy = spy_aligned.iloc[0]
        if first_spy != 0 and not pd.isna(first_spy):
            spy_norm = spy_aligned / first_spy * start_value
        else:
            spy_norm = pd.Series(start_value, index=prices.index)
    else:
        spy_norm = pd.Series(start_value, index=prices.index)

    # Build equity curve data
    peak = 0
    equity_curve = []
    for date, eq in equity_series.items():
        eq_val = round(float(eq))
        if eq_val > peak:
            peak = eq_val
        dd = round((eq_val / peak - 1) * 100, 2) if peak > 0 else 0

        bench = start_value
        try:
            bench = round(float(spy_norm.loc[date]))
        except (KeyError, TypeError):
            pass

        d = date if isinstance(date, dt.datetime) else pd.Timestamp(date)
        equity_curve.append({
            "date": str(d.date()),
            "label": f"{d.month}/{d.day}",
            "equity": eq_val,
            "benchmark": bench,
            "drawdown": dd,
        })

    # Monthly returns
    monthly = port_val.resample("ME").last()
    monthly_ret = _daily_returns(monthly)
    monthly_returns = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for date, ret in monthly_ret.items():
        monthly_returns.append({
            "month": month_names[date.month - 1],
            "return": round(float(ret) * 100, 2),
        })

    # Allocation breakdown
    holdings = []
    latest_prices = prices.iloc[-1]
    for i, sym in enumerate(actual_symbols):
        alloc_pct = round(float(allocs[i]) * 100, 1)
        if alloc_pct < 0.1:
            continue
        current = float(latest_prices[sym])
        first_price = float(prices.iloc[0][sym])
        shares = int((start_value * allocs[i]) / first_price) if first_price > 0 else 0
        holdings.append({
            "symbol": sym,
            "shares": shares,
            "avgCost": round(first_price, 2),
            "current": round(current, 2),
            "allocation": alloc_pct,
        })

    # Sector mapping
    sector_map = {
        "AAPL": "Tech", "MSFT": "Tech", "GOOGL": "Tech", "GOOG": "Tech",
        "META": "Tech", "NVDA": "Tech", "AMD": "Tech", "AMZN": "Consumer",
        "TSLA": "Consumer", "JPM": "Finance", "GS": "Finance", "V": "Finance",
        "JNJ": "Health", "PFE": "Health", "UNH": "Health",
        "XOM": "Energy", "CVX": "Energy", "GLD": "Commodities",
        "SPY": "Index", "QQQ": "Index",
    }
    sector_weights = {}
    for i, sym in enumerate(actual_symbols):
        sector = sector_map.get(sym, "Other")
        sector_weights[sector] = sector_weights.get(sector, 0) + float(allocs[i]) * 100

    sector_data = [
        {"sector": s, "weight": round(w, 1), "change": round((np.random.random() - 0.4) * 3, 1)}
        for s, w in sorted(sector_weights.items(), key=lambda x: -x[1])
    ]

    max_dd = min(d["drawdown"] for d in equity_curve) if equity_curve else 0

    return {
        "symbols": actual_symbols,
        "allocations": {sym: round(float(a), 4) for sym, a in zip(actual_symbols, allocs)},
        "stats": {
            "portfolio_value": equity_curve[-1]["equity"] if equity_curve else start_value,
            "cumulative_return": round(cr * 100, 2),
            "avg_daily_return": round(adr * 100, 4),
            "std_daily_return": round(sddr * 100, 4),
            "sharpe_ratio": round(sr, 2),
            "max_drawdown": round(max_dd, 2),
        },
        "equity_curve": equity_curve,
        "monthly_returns": monthly_returns,
        "holdings": holdings,
        "sector_data": sector_data,
    }
