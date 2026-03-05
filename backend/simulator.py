"""
Simulated trade feed generator.
Produces realistic-looking trades based on the optimized portfolio's holdings.
"""

import random
import datetime as dt


def generate_trades(holdings: list[dict], num_trades: int = 20) -> list[dict]:
    """
    Generate simulated trades based on current holdings.
    Mixes open and closed positions with realistic P&L.
    """
    if not holdings:
        return []

    symbols = [h["symbol"] for h in holdings]
    price_map = {h["symbol"]: h["current"] for h in holdings}
    trades = []

    now = dt.datetime.now().replace(second=0, microsecond=0)

    for i in range(num_trades):
        sym = random.choice(symbols)
        base_price = price_map.get(sym, 100.0)
        side = random.choice(["BUY", "SELL"])
        qty = random.choice([25, 50, 75, 100, 150, 200, 250, 300])
        price = round(base_price * (1 + random.uniform(-0.02, 0.02)), 2)

        # First 2-3 trades are open, rest closed
        if i < random.randint(2, 3):
            status = "OPEN"
            pnl = None
        else:
            status = "CLOSED"
            # Slight positive bias (55% win rate)
            if random.random() < 0.55:
                pnl = round(random.uniform(50, 3000), 0)
            else:
                pnl = -round(random.uniform(50, 2000), 0)
            pnl = int(pnl)

        trade_time = now - dt.timedelta(minutes=i * random.randint(8, 25))
        trades.append({
            "id": i + 1,
            "time": trade_time.strftime("%H:%M:%S"),
            "symbol": sym,
            "side": side,
            "qty": qty,
            "price": price,
            "pnl": pnl,
            "status": status,
        })

    return trades


def compute_trade_stats(trades: list[dict]) -> dict:
    """Compute session statistics from trade list."""
    closed = [t for t in trades if t["pnl"] is not None]
    winners = [t for t in closed if t["pnl"] > 0]
    losers = [t for t in closed if t["pnl"] < 0]

    total_pnl = sum(t["pnl"] for t in closed)
    win_rate = round(len(winners) / len(closed) * 100) if closed else 0

    avg_win = round(sum(t["pnl"] for t in winners) / len(winners)) if winners else 0
    avg_loss = round(sum(t["pnl"] for t in losers) / len(losers)) if losers else 0
    largest_win = max((t["pnl"] for t in winners), default=0)
    largest_loss = min((t["pnl"] for t in losers), default=0)

    gross_wins = sum(t["pnl"] for t in winners) if winners else 0
    gross_losses = abs(sum(t["pnl"] for t in losers)) if losers else 1
    profit_factor = round(gross_wins / gross_losses, 2) if gross_losses > 0 else 0

    expectancy = round(total_pnl / len(closed)) if closed else 0

    return {
        "total_trades": len(trades),
        "winners": len(winners),
        "losers": len(losers),
        "open_positions": len([t for t in trades if t["status"] == "OPEN"]),
        "total_pnl": total_pnl,
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "largest_win": largest_win,
        "largest_loss": largest_loss,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "avg_holding_time": f"{random.randint(20, 90)}m",
    }
