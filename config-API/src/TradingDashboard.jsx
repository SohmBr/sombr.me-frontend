import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE = "/api";

async function fetchPortfolio(symbols, start, end) {
  const params = new URLSearchParams({ symbols: symbols.join(","), start, end });
  const res = await fetch(`${API_BASE}/portfolio?${params}`);
  if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
  return res.json();
}

async function fetchTrades(symbols, start, end, count = 20) {
  const params = new URLSearchParams({ symbols: symbols.join(","), start, end, count: String(count) });
  const res = await fetch(`${API_BASE}/trades?${params}`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const font = `'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace`;
const fontSans = `'DM Sans', 'Helvetica Neue', sans-serif`;

const theme = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
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

const PIE_COLORS = ["#00e5a0", "#00b8d4", "#7c6fff", "#ff6b8a", "#ffb74d", "#4fc3f7"];

// ─── Shared Components ────────────────────────────────────────────────────────

function StatCard({ label, value, subValue, trend, prefix = "", suffix = "" }) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";
  return (
    <div style={{
      background: theme.card, border: `1px solid ${theme.cardBorder}`,
      borderRadius: 10, padding: "18px 20px", minWidth: 0,
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
      display: "grid", gridTemplateColumns: "62px 60px 50px 48px 80px 72px 68px",
      gap: 8, padding: "8px 0", borderBottom: `1px solid ${theme.cardBorder}`,
      fontFamily: font, fontSize: 12, alignItems: "center",
      opacity: 0, animation: `fadeSlideIn 0.3s ease forwards`, animationDelay: `${idx * 0.03}s`,
    }}>
      <span style={{ color: theme.textDim }}>{trade.time}</span>
      <span style={{ color: theme.text, fontWeight: 600 }}>{trade.symbol}</span>
      <span style={{
        color: isBuy ? theme.accent : theme.red, fontWeight: 700, fontSize: 10,
        background: isBuy ? theme.accentDim : theme.redDim, padding: "2px 6px", borderRadius: 3, textAlign: "center",
      }}>{trade.side}</span>
      <span style={{ color: theme.textDim, textAlign: "right" }}>{trade.qty}</span>
      <span style={{ color: theme.text, textAlign: "right" }}>${trade.price.toFixed(2)}</span>
      <span style={{
        color: trade.pnl === null ? theme.textMuted : trade.pnl >= 0 ? theme.accent : theme.red,
        textAlign: "right", fontWeight: 500,
      }}>
        {trade.pnl === null ? "—" : `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toLocaleString()}`}
      </span>
      <span style={{
        fontSize: 10, color: trade.status === "OPEN" ? theme.orange : theme.textMuted,
        textAlign: "right", fontWeight: trade.status === "OPEN" ? 600 : 400,
      }}>{trade.status}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a2332", border: `1px solid ${theme.cardBorder}`,
      borderRadius: 8, padding: "10px 14px", fontFamily: font, fontSize: 11,
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

function LoadingOverlay() {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,14,23,0.85)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        width: 48, height: 48, border: `3px solid ${theme.cardBorder}`,
        borderTop: `3px solid ${theme.accent}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ fontFamily: fontSans, fontSize: 14, color: theme.textDim, marginTop: 16 }}>
        Optimizing portfolio...
      </div>
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ symbols, startDate, endDate, onSymbolsChange, onStartChange, onEndChange, onRun, loading }) {
  const inputStyle = {
    background: theme.bg, border: `1px solid ${theme.cardBorder}`, borderRadius: 6,
    padding: "8px 12px", fontFamily: font, fontSize: 12, color: theme.text, outline: "none",
    width: "100%",
  };
  return (
    <div style={{
      background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10,
      padding: "16px 20px", marginBottom: 20,
      display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 320px", minWidth: 200 }}>
        <label style={{ fontFamily: fontSans, fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>
          Symbols (comma-separated)
        </label>
        <input
          style={inputStyle}
          value={symbols}
          onChange={(e) => onSymbolsChange(e.target.value)}
          placeholder="AAPL, MSFT, GOOGL, NVDA"
        />
      </div>
      <div style={{ flex: "0 0 150px" }}>
        <label style={{ fontFamily: fontSans, fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>
          Start Date
        </label>
        <input style={inputStyle} type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} />
      </div>
      <div style={{ flex: "0 0 150px" }}>
        <label style={{ fontFamily: fontSans, fontSize: 11, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>
          End Date
        </label>
        <input style={inputStyle} type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} />
      </div>
      <button
        onClick={onRun}
        disabled={loading}
        style={{
          background: loading ? theme.textMuted : `linear-gradient(135deg, ${theme.accent}, ${theme.blue})`,
          border: "none", borderRadius: 8, padding: "10px 28px",
          fontFamily: fontSans, fontSize: 13, fontWeight: 600,
          color: theme.bg, cursor: loading ? "not-allowed" : "pointer",
          transition: "opacity 0.2s", flexShrink: 0,
        }}
      >
        {loading ? "Running..." : "Optimize"}
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TradingDashboard() {
  // Config state
  const [symbolInput, setSymbolInput] = useState("AAPL, MSFT, GOOGL, NVDA, AMZN, META");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");

  // Data state
  const [portfolio, setPortfolio] = useState(null);
  const [tradeData, setTradeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const runOptimization = useCallback(async () => {
    const syms = symbolInput.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (syms.length < 2) {
      setError("Please enter at least 2 symbols.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pData, tData] = await Promise.all([
        fetchPortfolio(syms, startDate, endDate),
        fetchTrades(syms, startDate, endDate, 20),
      ]);
      setPortfolio(pData);
      setTradeData(tData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbolInput, startDate, endDate]);

  // Auto-run on first load
  useEffect(() => { runOptimization(); }, []);

  // Derived data
  const stats = portfolio?.stats || {};
  const equityData = portfolio?.equity_curve || [];
  const monthlyReturns = portfolio?.monthly_returns || [];
  const holdings = portfolio?.holdings || [];
  const sectorData = portfolio?.sector_data || [];
  const trades = tradeData?.trades || [];
  const sessionStats = tradeData?.session_stats || {};

  const tabs = ["overview", "trades", "algorithm"];

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", color: theme.text, fontFamily: fontSans }}>
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
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>

      {loading && <LoadingOverlay />}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 28px", borderBottom: `1px solid ${theme.cardBorder}`, background: "#0d1220",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: font, fontWeight: 700, fontSize: 14, color: theme.bg,
          }}>α</div>
          <div>
            <div style={{ fontFamily: fontSans, fontWeight: 700, fontSize: 16, color: theme.text, letterSpacing: -0.3 }}>ALPHA ENGINE</div>
            <div style={{ fontFamily: font, fontSize: 10, color: theme.textMuted, letterSpacing: 0.5 }}>QUANTITATIVE TRADING SYSTEM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {portfolio && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: font, fontSize: 11, color: theme.accent }}>LIVE</span>
            </div>
          )}
          <div style={{ fontFamily: font, fontSize: 13, color: theme.textDim }}>
            {clock.toLocaleTimeString("en-US", { hour12: false })} EST
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", gap: 0, padding: "0 28px",
        borderBottom: `1px solid ${theme.cardBorder}`, background: "#0d1220",
      }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none",
            borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : "2px solid transparent",
            padding: "12px 20px", fontFamily: fontSans, fontSize: 13,
            fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? theme.text : theme.textMuted,
            cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s",
          }}>{tab}</button>
        ))}
      </nav>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Config Panel */}
        <ConfigPanel
          symbols={symbolInput} startDate={startDate} endDate={endDate}
          onSymbolsChange={setSymbolInput} onStartChange={setStartDate} onEndChange={setEndDate}
          onRun={runOptimization} loading={loading}
        />

        {error && (
          <div style={{
            background: theme.redDim, border: `1px solid ${theme.red}`, borderRadius: 8,
            padding: "12px 16px", marginBottom: 20, fontFamily: font, fontSize: 13, color: theme.red,
          }}>
            {error}
          </div>
        )}

        {!portfolio && !loading && !error && (
          <div style={{ textAlign: "center", padding: 60, color: theme.textDim, fontFamily: fontSans, fontSize: 15 }}>
            Enter symbols and date range, then click <strong style={{ color: theme.accent }}>Optimize</strong> to begin.
          </div>
        )}

        {portfolio && activeTab === "overview" && (
          <>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
              <StatCard label="Portfolio Value" value={`$${stats.portfolio_value?.toLocaleString()}`} subValue={`${stats.cumulative_return}% total return`} trend={stats.cumulative_return >= 0 ? "up" : "down"} />
              <StatCard label="Today's P&L" value={`$${sessionStats.total_pnl?.toLocaleString() || 0}`} subValue={`across ${sessionStats.total_trades || 0} trades`} trend={(sessionStats.total_pnl || 0) >= 0 ? "up" : "down"} />
              <StatCard label="Sharpe Ratio" value={stats.sharpe_ratio} subValue="vs 1.0 benchmark" trend={stats.sharpe_ratio >= 1 ? "up" : "down"} />
              <StatCard label="Max Drawdown" value={`${stats.max_drawdown}%`} subValue="peak-to-trough" trend="down" />
              <StatCard label="Win Rate" value={`${sessionStats.win_rate || 0}%`} subValue={`Avg W: $${sessionStats.avg_win || 0} / L: $${sessionStats.avg_loss || 0}`} trend={(sessionStats.win_rate || 0) > 50 ? "up" : "down"} />
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
                    <YAxis tick={{ fill: theme.textMuted, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={["dataMin - 5000", "dataMax + 5000"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke={theme.accent} fill="url(#eqGrad)" strokeWidth={2} name="Portfolio" dot={false} />
                    <Line type="monotone" dataKey="benchmark" stroke={theme.textMuted} strokeWidth={1.5} strokeDasharray="4 4" name="S&P 500" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Returns */}
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Monthly Returns" tag={startDate.slice(0, 4)} />
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
                      <Pie data={holdings} dataKey="allocation" nameKey="symbol" cx="50%" cy="50%" innerRadius={40} outerRadius={70} strokeWidth={0}>
                        {holdings.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {holdings.map((h, i) => (
                      <div key={h.symbol} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
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
                  {sectorData.map(s => (
                    <div key={s.sector}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: font, fontSize: 11, color: theme.text }}>{s.sector}</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontFamily: font, fontSize: 11, color: theme.textDim }}>{s.weight}%</span>
                          <span style={{ fontFamily: font, fontSize: 11, color: s.change >= 0 ? theme.accent : theme.red }}>
                            {s.change >= 0 ? "+" : ""}{s.change}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: theme.cardBorder, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${s.weight}%`,
                          background: `linear-gradient(90deg, ${theme.accent}, ${theme.blue})`,
                          borderRadius: 2, transition: "width 1s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {portfolio && activeTab === "trades" && (
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 16 }}>
            {/* Trade Feed */}
            <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
              <SectionHeader title="Trade Feed" tag="SIMULATED" />
              <div style={{
                display: "grid", gridTemplateColumns: "62px 60px 50px 48px 80px 72px 68px",
                gap: 8, padding: "8px 0", borderBottom: `1px solid ${theme.cardBorder}`,
                fontFamily: font, fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
              }}>
                <span>Time</span><span>Symbol</span><span>Side</span>
                <span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Price</span>
                <span style={{ textAlign: "right" }}>P&L</span>
                <span style={{ textAlign: "right" }}>Status</span>
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {trades.map((trade, i) => <TradeRow key={trade.id} trade={trade} idx={i} />)}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Session Stats" />
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
                  {[
                    ["Total Trades", sessionStats.total_trades],
                    ["Winners", sessionStats.winners],
                    ["Losers", sessionStats.losers],
                    ["Avg Holding Time", sessionStats.avg_holding_time],
                    ["Largest Win", sessionStats.largest_win ? `+$${sessionStats.largest_win.toLocaleString()}` : "$0"],
                    ["Largest Loss", sessionStats.largest_loss ? `-$${Math.abs(sessionStats.largest_loss).toLocaleString()}` : "$0"],
                    ["Profit Factor", sessionStats.profit_factor],
                    ["Expectancy", sessionStats.expectancy ? `${sessionStats.expectancy >= 0 ? "+" : ""}$${sessionStats.expectancy}` : "$0"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontFamily: font, fontSize: 12 }}>
                      <span style={{ color: theme.textDim }}>{label}</span>
                      <span style={{ color: theme.text, fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 20 }}>
                <SectionHeader title="Open Positions" tag={`${holdings.length}`} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {holdings.map(h => {
                    const pnl = (h.current - h.avgCost) * h.shares;
                    const pnlPct = ((h.current - h.avgCost) / h.avgCost * 100).toFixed(1);
                    return (
                      <div key={h.symbol} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", background: theme.bg, borderRadius: 6, fontFamily: font, fontSize: 12,
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

        {portfolio && activeTab === "algorithm" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Strategy Overview */}
            <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 24 }}>
              <SectionHeader title="Strategy Overview" />
              <div style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.75, color: theme.textDim }}>
                <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: theme.text, marginBottom: 10 }}>
                  Sharpe Ratio Optimization
                </h3>
                <p style={{ marginBottom: 14 }}>
                  The core strategy uses Markowitz mean-variance optimization to maximize the portfolio's Sharpe ratio.
                  Given a set of assets and a historical period, the optimizer finds the allocation weights that
                  maximize risk-adjusted returns.
                </p>
                <p style={{ marginBottom: 14 }}>
                  The optimization uses scipy's SLSQP solver with constraints that all weights are between 0-1
                  (long only) and sum to 1.0 (fully invested). Historical daily returns from Yahoo Finance are used
                  to estimate expected returns and covariance.
                </p>
                <p>
                  Current portfolio: {portfolio.symbols?.join(", ")} optimized over {startDate} to {endDate},
                  achieving a Sharpe ratio of {stats.sharpe_ratio} with {stats.cumulative_return}% cumulative return.
                </p>
              </div>
            </div>

            {/* Technical Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: 24 }}>
                <SectionHeader title="Optimization Pipeline" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { step: "01", label: "Data Ingestion", desc: "Adjusted close prices via Yahoo Finance API" },
                    { step: "02", label: "Normalization", desc: "Prices normalized to day-1 base for relative comparison" },
                    { step: "03", label: "Return Calculation", desc: "Daily returns computed as (P_t / P_{t-1}) - 1" },
                    { step: "04", label: "Objective Function", desc: "Negative annualized Sharpe ratio (√252 × μ/σ)" },
                    { step: "05", label: "Optimization", desc: "SLSQP minimization with bound [0,1] and Σw=1 constraints" },
                    { step: "06", label: "Output", desc: "Optimal allocations, equity curve, and performance metrics" },
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
                <SectionHeader title="API Endpoints" tag="REST" />
                <div style={{
                  background: theme.bg, borderRadius: 8, padding: 16,
                  fontFamily: font, fontSize: 12, color: theme.textDim, lineHeight: 1.7,
                  border: `1px solid ${theme.cardBorder}`,
                }}>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/portfolio</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/equity-curve</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/metrics</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/trades</span></div>
                  <div><span style={{ color: theme.accent }}>GET</span>  <span style={{ color: theme.text }}>/api/health</span></div>
                  <div style={{ marginTop: 10, color: theme.textMuted, fontSize: 11 }}>
                    All endpoints accept query params: symbols, start, end.
                    <br />Powered by FastAPI · Auto-docs at /docs
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={{
        padding: "16px 28px", borderTop: `1px solid ${theme.cardBorder}`,
        display: "flex", justifyContent: "space-between",
        fontFamily: font, fontSize: 10, color: theme.textMuted,
      }}>
        <span>Simulated trades · Real historical price data · Not financial advice</span>
        <span>FastAPI + React + Recharts · Sharpe Ratio Optimization</span>
      </footer>
    </div>
  );
}
