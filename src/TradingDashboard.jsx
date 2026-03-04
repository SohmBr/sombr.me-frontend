import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Simulated Data ───────────────────────────────────────────────────────────
const generateEquityCurve = () => {
  const data = [];
  let equity = 100000;
  let benchmark = 100000;
  const startDate = new Date(2024, 0, 2);
  for (let i = 0; i < 300; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const ret = (Math.random() - 0.47) * 0.018;
    const benchRet = (Math.random() - 0.48) * 0.012;
    equity *= (1 + ret);
    benchmark *= (1 + benchRet);
    data.push({
      date: date.toISOString().split("T")[0],
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      equity: Math.round(equity),
      benchmark: Math.round(benchmark),
      drawdown: Math.round((equity / Math.max(...data.map(d => d.equity || equity), equity) - 1) * 10000) / 100
    });
  }
  // recalc drawdown properly
  let peak = 0;
  data.forEach(d => {
    if (d.equity > peak) peak = d.equity;
    d.drawdown = Math.round((d.equity / peak - 1) * 10000) / 100;
  });
  return data;
};

const generateMonthlyReturns = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map(m => ({
    month: m,
    return: Math.round((Math.random() - 0.4) * 8 * 100) / 100
  }));
};

const TRADES = [
  { id: 1, time: "14:32:07", symbol: "NVDA", side: "BUY", qty: 150, price: 878.35, pnl: null, status: "OPEN" },
  { id: 2, time: "14:28:41", symbol: "AAPL", side: "SELL", qty: 200, price: 189.72, pnl: 1240, status: "CLOSED" },
  { id: 3, time: "14:15:03", symbol: "TSLA", side: "BUY", qty: 80, price: 245.60, pnl: null, status: "OPEN" },
  { id: 4, time: "13:58:22", symbol: "META", side: "SELL", qty: 100, price: 502.14, pnl: -380, status: "CLOSED" },
  { id: 5, time: "13:42:55", symbol: "AMZN", side: "BUY", qty: 60, price: 178.92, pnl: 890, status: "CLOSED" },
  { id: 6, time: "13:31:10", symbol: "MSFT", side: "SELL", qty: 120, price: 415.60, pnl: 2100, status: "CLOSED" },
  { id: 7, time: "13:15:44", symbol: "GOOGL", side: "BUY", qty: 90, price: 155.28, pnl: -520, status: "CLOSED" },
  { id: 8, time: "12:58:33", symbol: "AMD", side: "SELL", qty: 250, price: 172.45, pnl: 1780, status: "CLOSED" },
  { id: 9, time: "12:42:17", symbol: "SPY", side: "BUY", qty: 300, price: 512.30, pnl: 430, status: "CLOSED" },
  { id: 10, time: "12:28:05", symbol: "QQQ", side: "SELL", qty: 180, price: 438.92, pnl: -210, status: "CLOSED" },
  { id: 11, time: "12:10:48", symbol: "JPM", side: "BUY", qty: 110, price: 198.44, pnl: 670, status: "CLOSED" },
  { id: 12, time: "11:55:31", symbol: "V", side: "SELL", qty: 75, price: 282.10, pnl: 1540, status: "CLOSED" },
];

const HOLDINGS = [
  { symbol: "NVDA", shares: 150, avgCost: 878.35, current: 892.10, allocation: 28.4 },
  { symbol: "TSLA", shares: 80, avgCost: 245.60, current: 251.20, allocation: 18.2 },
  { symbol: "AAPL", shares: 300, avgCost: 182.40, current: 189.72, allocation: 15.6 },
  { symbol: "MSFT", shares: 120, avgCost: 408.20, current: 415.60, allocation: 14.1 },
  { symbol: "AMZN", shares: 160, avgCost: 174.30, current: 178.92, allocation: 12.8 },
  { symbol: "META", shares: 50, avgCost: 495.80, current: 502.14, allocation: 10.9 },
];

const PIE_COLORS = ["#00e5a0", "#00b8d4", "#7c6fff", "#ff6b8a", "#ffb74d", "#4fc3f7"];

const SECTOR_DATA = [
  { sector: "Tech", weight: 62, change: 2.1 },
  { sector: "Consumer", weight: 15, change: -0.8 },
  { sector: "Finance", weight: 12, change: 1.4 },
  { sector: "Health", weight: 7, change: 0.3 },
  { sector: "Energy", weight: 4, change: -1.2 },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const font = `'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace`;
const fontSans = `'DM Sans', 'Helvetica Neue', sans-serif`;

const theme = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
  cardHover: "#162033",
  text: "#e2e8f0",
  textDim: "#64748b",
  textMuted: "#475569",
  accent: "#00e5a0",
  accentDim: "#00e5a020",
  red: "#ff4d6a",
  redDim: "#ff4d6a20",
  blue: "#38bdf8",
  purple: "#8b5cf6",
  orange: "#f59e0b",
  gridLine: "#1e293b",
};

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, subValue, trend, prefix = "", suffix = "" }) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";
  return (
    <div style={{
      background: theme.card,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: 10,
      padding: "18px 20px",
      minWidth: 0,
      transition: "border-color 0.2s",
    }}>
      <div style={{ fontFamily: fontSans, fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: font, fontSize: 26, fontWeight: 700, color: isPositive ? theme.accent : isNegative ? theme.red : theme.text, lineHeight: 1 }}>
        {prefix}{value}{suffix}
      </div>
      {subValue && (
        <div style={{ fontFamily: font, fontSize: 12, color: isPositive ? theme.accent : isNegative ? theme.red : theme.textDim, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          {isPositive && "▲"}{isNegative && "▼"} {subValue}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, tag }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 18, background: theme.accent, borderRadius: 2 }} />
      <h2 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: theme.text, margin: 0 }}>{title}</h2>
      {tag && <span style={{ fontFamily: font, fontSize: 10, color: theme.accent, background: theme.accentDim, padding: "2px 8px", borderRadius: 4 }}>{tag}</span>}
    </div>
  );
}

function TradeRow({ trade, idx }) {
  const isBuy = trade.side === "BUY";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "62px 60px 50px 48px 80px 72px 68px",
      gap: 8,
      padding: "8px 0",
      borderBottom: `1px solid ${theme.cardBorder}`,
      fontFamily: font,
      fontSize: 12,
      alignItems: "center",
      opacity: 0,
      animation: `fadeSlideIn 0.3s ease forwards`,
      animationDelay: `${idx * 0.03}s`,
    }}>
      <span style={{ color: theme.textDim }}>{trade.time}</span>
      <span style={{ color: theme.text, fontWeight: 600 }}>{trade.symbol}</span>
      <span style={{
        color: isBuy ? theme.accent : theme.red,
        fontWeight: 700,
        fontSize: 10,
        background: isBuy ? theme.accentDim : theme.redDim,
        padding: "2px 6px",
        borderRadius: 3,
        textAlign: "center",
      }}>{trade.side}</span>
      <span style={{ color: theme.textDim, textAlign: "right" }}>{trade.qty}</span>
      <span style={{ color: theme.text, textAlign: "right" }}>${trade.price.toFixed(2)}</span>
      <span style={{
        color: trade.pnl === null ? theme.textMuted : trade.pnl >= 0 ? theme.accent : theme.red,
        textAlign: "right",
        fontWeight: 500,
      }}>
        {trade.pnl === null ? "—" : `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toLocaleString()}`}
      </span>
      <span style={{
        fontSize: 10,
        color: trade.status === "OPEN" ? theme.orange : theme.textMuted,
        textAlign: "right",
        fontWeight: trade.status === "OPEN" ? 600 : 400,
      }}>{trade.status}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a2332",
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: 8,
      padding: "10px 14px",
      fontFamily: font,
      fontSize: 11,
    }}>
      <div style={{ color: theme.textDim, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? (p.name === "Drawdown" ? `${p.value}%` : `$${p.value.toLocaleString()}`) : p.value}
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TradingDashboard() {
  const [equityData] = useState(generateEquityCurve);
  const [monthlyReturns] = useState(generateMonthlyReturns);
  const [activeTab, setActiveTab] = useState("overview");
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastEquity = equityData[equityData.length - 1]?.equity || 0;
  const totalReturn = ((lastEquity - 100000) / 100000 * 100).toFixed(2);
  const maxDD = Math.min(...equityData.map(d => d.drawdown)).toFixed(2);
  const winRate = Math.round(TRADES.filter(t => t.pnl > 0).length / TRADES.filter(t => t.pnl !== null).length * 100);
  const totalPnl = TRADES.reduce((s, t) => s + (t.pnl || 0), 0);
  const sharpe = (parseFloat(totalReturn) / Math.abs(parseFloat(maxDD)) * 1.2).toFixed(2);
  const avgWin = Math.round(TRADES.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / TRADES.filter(t => t.pnl > 0).length);
  const avgLoss = Math.round(TRADES.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / TRADES.filter(t => t.pnl < 0).length);

  const tabs = ["overview", "trades", "algorithm"];

  return (
    <div style={{
      background: theme.bg,
      minHeight: "100vh",
      color: theme.text,
      fontFamily: fontSans,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${theme.bg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.cardBorder}; border-radius: 3px; }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 28px",
        borderBottom: `1px solid ${theme.cardBorder}`,
        background: "#0d1220",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: font, fontWeight: 700, fontSize: 14, color: theme.bg,
          }}>α</div>
          <div>
            <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 16, color: theme.text, letterSpacing: -0.3 }}>SOMBR ENGINE</div>
            <div style={{ fontFamily: font, fontSize: 10, color: theme.textMuted, letterSpacing: 0.5 }}>QUANTITATIVE TRADING SYSTEM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: font, fontSize: 11, color: theme.accent }}>LIVE</span>
          </div>
          <div style={{ fontFamily: font, fontSize: 13, color: theme.textDim }}>
            {clock.toLocaleTimeString("en-US", { hour12: false })} EST
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <nav style={{
        display: "flex",
        gap: 0,
        padding: "0 28px",
        borderBottom: `1px solid ${theme.cardBorder}`,
        background: "#0d1220",
      }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : "2px solid transparent",
            padding: "12px 20px",
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? theme.text : theme.textMuted,
            cursor: "pointer",
            textTransform: "capitalize",
            transition: "all 0.2s",
          }}>{tab}</button>
        ))}
      </nav>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

        {activeTab === "overview" && (
          <>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
              <StatCard label="Portfolio Value" value={`$${lastEquity.toLocaleString()}`} subValue={`${totalReturn}% total return`} trend={parseFloat(totalReturn) >= 0 ? "up" : "down"} />
              <StatCard label="Today's P&L" value={`$${totalPnl.toLocaleString()}`} subValue="across 12 trades" trend={totalPnl >= 0 ? "up" : "down"} />
              <StatCard label="Sharpe Ratio" value={sharpe} subValue="vs 1.0 benchmark" trend="up" />
              <StatCard label="Max Drawdown" value={`${maxDD}%`} subValue="peak-to-trough" trend="down" />
              <StatCard label="Win Rate" value={`${winRate}%`} subValue={`Avg W: $${avgWin} / L: $${avgLoss}`} trend={winRate > 50 ? "up" : "down"} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Equity Curve */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Equity Curve" tag="vs S&P 500" />
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={equityData.filter((_, i) => i % 3 === 0)}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.accent} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.gridLine} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} interval={15} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} domain={['dataMin - 5000', 'dataMax + 5000']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke={theme.accent} fill="url(#eqGrad)" strokeWidth={2} name="Portfolio" dot={false} />
                    <Line type="monotone" dataKey="benchmark" stroke={theme.textMuted} strokeWidth={1.5} strokeDasharray="4 4" name="S&P 500" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Returns */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Monthly Returns" tag="2024" />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyReturns} barCategoryGap="20%">
                    <CartesianGrid stroke={theme.gridLine} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke={theme.textMuted} strokeWidth={0.5} />
                    <Bar dataKey="return" name="Return" radius={[3, 3, 0, 0]}>
                      {monthlyReturns.map((entry, i) => (
                        <Cell key={i} fill={entry.return >= 0 ? theme.accent : theme.red} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {/* Drawdown */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Drawdown" />
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={equityData.filter((_, i) => i % 3 === 0)}>
                    <defs>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.red} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={theme.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.gridLine} strokeDasharray="3 3" vertical={false} />
                    <YAxis tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="drawdown" stroke={theme.red} fill="url(#ddGrad)" strokeWidth={1.5} name="Drawdown" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Allocation Pie */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Allocation" />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={HOLDINGS} dataKey="allocation" nameKey="symbol" cx="50%" cy="50%" innerRadius={40} outerRadius={70} strokeWidth={0}>
                        {HOLDINGS.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {HOLDINGS.map((h, i) => (
                      <div key={h.symbol} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i] }} />
                        <span style={{ color: theme.text, fontWeight: 500, width: 40 }}>{h.symbol}</span>
                        <span style={{ color: theme.textDim }}>{h.allocation}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sector Exposure */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Sector Exposure" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                  {SECTOR_DATA.map(s => (
                    <div key={s.sector}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: font, fontSize: 11, color: theme.text }}>{s.sector}</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontFamily: font, fontSize: 11, color: theme.textDim }}>{s.weight}%</span>
                          <span style={{ fontFamily: font, fontSize: 11, color: s.change >= 0 ? theme.accent : theme.red }}>{s.change >= 0 ? "+" : ""}{s.change}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: theme.cardBorder, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${s.weight}%`,
                          background: `linear-gradient(90deg, ${theme.accent}, ${theme.blue})`,
                          borderRadius: 2,
                          transition: "width 1s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "trades" && (
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 16 }}>
            {/* Trade Feed */}
            <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
              <SectionHeader title="Trade Feed" tag="LIVE" />
              <div style={{
                display: "grid",
                gridTemplateColumns: "62px 60px 50px 48px 80px 72px 68px",
                gap: 8,
                padding: "8px 0",
                borderBottom: `1px solid ${theme.cardBorder}`,
                fontFamily: font,
                fontSize: 10,
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}>
                <span>Time</span><span>Symbol</span><span>Side</span><span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>P&L</span><span style={{ textAlign: "right" }}>Status</span>
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {TRADES.map((trade, i) => <TradeRow key={trade.id} trade={trade} idx={i} />)}
              </div>
            </div>

            {/* Trade Stats Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Session Stats" />
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
                  {[
                    ["Total Trades", "12"],
                    ["Winners", `${TRADES.filter(t => t.pnl > 0).length}`],
                    ["Losers", `${TRADES.filter(t => t.pnl < 0).length}`],
                    ["Avg Holding Time", "47m"],
                    ["Largest Win", `+$${Math.max(...TRADES.filter(t=>t.pnl>0).map(t=>t.pnl)).toLocaleString()}`],
                    ["Largest Loss", `-$${Math.abs(Math.min(...TRADES.filter(t=>t.pnl<0).map(t=>t.pnl))).toLocaleString()}`],
                    ["Profit Factor", "2.41"],
                    ["Expectancy", `+$${Math.round(totalPnl / TRADES.filter(t=>t.pnl!==null).length)}`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontFamily: font, fontSize: 12 }}>
                      <span style={{ color: theme.textDim }}>{label}</span>
                      <span style={{ color: theme.text, fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Holdings */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Open Positions" tag={`${HOLDINGS.length}`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {HOLDINGS.map(h => {
                    const pnl = (h.current - h.avgCost) * h.shares;
                    const pnlPct = ((h.current - h.avgCost) / h.avgCost * 100).toFixed(1);
                    return (
                      <div key={h.symbol} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", background: theme.bg, borderRadius: 6,
                        fontFamily: font, fontSize: 12,
                      }}>
                        <div>
                          <span style={{ color: theme.text, fontWeight: 600 }}>{h.symbol}</span>
                          <span style={{ color: theme.textMuted, marginLeft: 8 }}>{h.shares} shares</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: pnl >= 0 ? theme.accent : theme.red, fontWeight: 500 }}>
                            {pnl >= 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}
                          </div>
                          <div style={{ color: theme.textMuted, fontSize: 10 }}>{pnlPct}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "algorithm" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Strategy Overview */}
            <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 24 }}>
              <SectionHeader title="Strategy Overview" />
              <div style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.75, color: theme.textDim }}>
                <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: theme.text, marginBottom: 10 }}>Mean-Reversion Momentum Hybrid</h3>
                <p style={{ marginBottom: 14 }}>
                  The core strategy identifies short-term mean-reversion signals within intermediate-term momentum regimes.
                  Positions are initiated when price deviates beyond 2σ from a 20-period VWAP while the 50/200 EMA spread
                  confirms trend direction.
                </p>
                <p style={{ marginBottom: 14 }}>
                  Entry signals are filtered through a proprietary volatility regime classifier that adapts position sizing
                  based on realized vs implied vol spread. Risk is managed through dynamic stop-losses pegged to ATR multiples.
                </p>
                <p>
                  The system trades US equities in the top 200 by liquidity, with a maximum of 8 concurrent positions and
                  sector concentration limits of 40%.
                </p>
              </div>
            </div>

            {/* Technical Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 24 }}>
                <SectionHeader title="Signal Pipeline" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { step: "01", label: "Data Ingestion", desc: "Real-time L2 book data, 1m bars, options flow" },
                    { step: "02", label: "Feature Engine", desc: "120+ engineered features: microstructure, sentiment, cross-asset" },
                    { step: "03", label: "Regime Detection", desc: "HMM-based vol regime classifier (low/med/high/crisis)" },
                    { step: "04", label: "Signal Generation", desc: "Ensemble of mean-reversion + momentum alpha factors" },
                    { step: "05", label: "Position Sizing", desc: "Kelly-fraction with vol-targeting overlay" },
                    { step: "06", label: "Execution", desc: "TWAP/VWAP with adaptive urgency based on alpha decay" },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${theme.cardBorder}` }}>
                      <span style={{
                        fontFamily: font, fontSize: 11, fontWeight: 700, color: theme.accent,
                        background: theme.accentDim, padding: "3px 8px", borderRadius: 4, flexShrink: 0,
                      }}>{s.step}</span>
                      <div>
                        <div style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: theme.text }}>{s.label}</div>
                        <div style={{ fontFamily: font, fontSize: 11, color: theme.textDim, marginTop: 2 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 24 }}>
                <SectionHeader title="API Integration" tag="REST" />
                <div style={{
                  background: theme.bg, borderRadius: 8, padding: 16,
                  fontFamily: font, fontSize: 12, color: theme.textDim, lineHeight: 1.7,
                  border: `1px solid ${theme.cardBorder}`,
                }}>
                  <div><span style={{ color: theme.purple }}>POST</span> <span style={{ color: theme.text }}>/api/trades</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/portfolio</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/metrics</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/equity-curve</span></div>
                  <div style={{ marginTop: 10, color: theme.textMuted, fontSize: 11 }}>
                    All endpoints accept JSON. Auth via Bearer token.
                    <br />Dashboard polls /api/trades every 5s for live updates.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={{
        padding: "16px 28px",
        borderTop: `1px solid ${theme.cardBorder}`,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: font,
        fontSize: 10,
        color: theme.textMuted,
      }}>
        <span>Paper trading · Simulated data · Not financial advice</span>
        <span>Built with React + Recharts · API-ready architecture</span>
      </footer>
    </div>
  );
}
