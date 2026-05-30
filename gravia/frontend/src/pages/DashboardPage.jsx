import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";
import PaywallGate from "../components/PaywallGate";

const API = import.meta.env.VITE_API_URL ?? "/api";

const ALL_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT"];

function fmt(n, decimals) {
  if (n == null) return "—";
  const d = decimals ?? (n >= 1000 ? 2 : 4);
  return n >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : n.toFixed(d);
}
function fmtVol(v) {
  if (!v) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  return v.toFixed(0);
}

function StatusBar({ connected, simulated, user, plan }) {
  return (
    <div className="flex items-center gap-4 text-[10px] text-gray-500 border-b border-white/5 px-4 py-1.5 bg-surface2">
      <span className="text-brand font-bold">GRAVIA</span>
      <span className="text-gray-700">|</span>
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-brand animate-pulse-slow" : simulated ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
        {connected ? "LIVE" : simulated ? "SIMULATED" : "OFFLINE"}
      </span>
      <span className="text-gray-700">|</span>
      <span>{user?.email}</span>
      <span className="ml-auto text-brand uppercase font-bold">{plan}</span>
    </div>
  );
}

function PriceTable({ feed }) {
  const rows = feed.getAll();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 border-b border-white/5">
            <th className="text-left py-2 px-3 font-normal">Symbol</th>
            <th className="text-right py-2 px-3 font-normal">Last</th>
            <th className="text-right py-2 px-3 font-normal">24h %</th>
            <th className="text-right py-2 px-3 font-normal hidden md:table-cell">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? ALL_SYMBOLS.map((sym) => (
                <tr key={sym} className="border-b border-white/3 animate-pulse">
                  <td className="py-2.5 px-3 text-gray-500">{sym}</td>
                  <td className="py-2.5 px-3 text-right"><div className="h-3 bg-white/5 rounded w-20 ml-auto" /></td>
                  <td className="py-2.5 px-3 text-right"><div className="h-3 bg-white/5 rounded w-12 ml-auto" /></td>
                  <td className="py-2.5 px-3 text-right hidden md:table-cell"><div className="h-3 bg-white/5 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            : rows.map((d) => (
                <tr key={d.symbol} className="border-b border-white/3 hover:bg-white/2 transition">
                  <td className="py-2.5 px-3 text-white font-bold">{d.symbol}</td>
                  <td className="py-2.5 px-3 text-right text-white tabular-nums">${fmt(d.price)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums ${d.change24h >= 0 ? "text-brand" : "text-red-400"}`}>
                    {d.change24h >= 0 ? "▲ +" : "▼ "}{d.change24h.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500 hidden md:table-cell tabular-nums">
                    {fmtVol(d.volume24h)}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

function TickerStrip({ feed }) {
  const rows = feed.getAll();
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden bg-surface3 border-t border-white/5 py-1.5 text-[10px] text-gray-500">
      <div className="flex gap-8 animate-ticker-scroll whitespace-nowrap">
        {[...rows, ...rows].map((d, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold">{d.symbol.replace("USDT","")}</span>
            <span>${fmt(d.price)}</span>
            <span className={d.change24h >= 0 ? "text-brand" : "text-red-400"}>
              {d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, session, isPro, isEnterprise, plan, signOut } = useAuth();
  const navigate = useNavigate();
  const feed = useBinanceFeed();
  const [activeTab, setActiveTab] = useState("market");

  async function openPortal() {
    const res = await fetch(`${API}/portal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  const btc = feed.get("BTCUSDT");
  const eth = feed.get("ETHUSDT");

  const TABS = ["market", "advanced", "api"];

  return (
    <div className="min-h-screen bg-surface font-mono flex flex-col text-xs">
      <StatusBar connected={feed.connected} simulated={feed.simulated} user={user} plan={plan} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider transition font-bold ${
                activeTab === t ? "bg-surface3 text-brand" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={openPortal} className="text-gray-600 hover:text-gray-400 transition text-[10px]">
            billing
          </button>
          <button onClick={handleSignOut} className="text-gray-600 hover:text-red-400 transition text-[10px]">
            sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">

        {/* ── Market tab ── */}
        {activeTab === "market" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Spotlight cards */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[btc, eth, feed.get("BNBUSDT"), feed.get("SOLUSDT")].map((d, i) => (
                <div key={i} className="bg-surface2 border border-white/5 rounded-lg p-3">
                  {d ? (
                    <>
                      <p className="text-gray-500 text-[10px] mb-1">{d.symbol}</p>
                      <p className="text-white font-bold text-base tabular-nums">${fmt(d.price)}</p>
                      <p className={`text-[11px] mt-0.5 ${d.change24h >= 0 ? "text-brand" : "text-red-400"}`}>
                        {d.change24h >= 0 ? "▲ +" : "▼ "}{d.change24h.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <div className="animate-pulse space-y-1">
                      <div className="h-2 bg-white/5 rounded w-16" />
                      <div className="h-4 bg-white/5 rounded w-20" />
                      <div className="h-2 bg-white/5 rounded w-12" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Price table (free — 2 pairs visible, rest gated) */}
            <div className="lg:col-span-2 bg-surface2 border border-white/5 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-gray-400 font-bold">Market Overview</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${feed.connected ? "bg-brand/10 text-brand" : "bg-yellow-400/10 text-yellow-400"}`}>
                  {feed.connected ? "● LIVE" : "○ SIM"}
                </span>
              </div>
              {isPro ? (
                <PriceTable feed={feed} />
              ) : (
                <>
                  {/* Free: show 2 rows ungated */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-600 border-b border-white/5">
                          <th className="text-left py-2 px-3 font-normal">Symbol</th>
                          <th className="text-right py-2 px-3 font-normal">Last</th>
                          <th className="text-right py-2 px-3 font-normal">24h %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {["BTCUSDT","ETHUSDT"].map((sym) => {
                          const d = feed.get(sym);
                          return (
                            <tr key={sym} className="border-b border-white/3">
                              <td className="py-2.5 px-3 text-white font-bold">{sym}</td>
                              <td className="py-2.5 px-3 text-right text-white tabular-nums">{d ? `$${fmt(d.price)}` : "—"}</td>
                              <td className={`py-2.5 px-3 text-right ${d?.change24h >= 0 ? "text-brand" : "text-red-400"}`}>
                                {d ? `${d.change24h >= 0 ? "▲ +" : "▼ "}${d.change24h.toFixed(2)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaywallGate requiredPlan="pro" label="Unlock all 6 pairs" blur={4}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {["BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT"].map((sym) => (
                            <tr key={sym} className="border-b border-white/3">
                              <td className="py-2.5 px-3 text-white font-bold">{sym}</td>
                              <td className="py-2.5 px-3 text-right text-white">$1,234.00</td>
                              <td className="py-2.5 px-3 text-right text-brand">▲ +2.34%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PaywallGate>
                </>
              )}
            </div>

            {/* Sidebar stats */}
            <div className="flex flex-col gap-3">
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">Your plan</p>
                <p className="text-white font-bold text-lg uppercase">{plan}</p>
                {!isPro && (
                  <button
                    onClick={() => navigate("/pricing")}
                    className="mt-3 w-full bg-brand text-black font-bold text-[10px] py-2 rounded hover:opacity-90 transition"
                  >
                    Upgrade to Pro →
                  </button>
                )}
                {isPro && (
                  <button onClick={openPortal} className="mt-3 w-full border border-white/10 text-gray-400 text-[10px] py-2 rounded hover:border-white/20 transition">
                    Manage billing
                  </button>
                )}
              </div>

              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">Feed status</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Source</span><span className="text-white">{feed.connected ? "Binance WS" : "Simulated"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pairs</span><span className="text-white">{feed.getAll().length} active</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Latency</span><span className={feed.connected ? "text-brand" : "text-yellow-400"}>{feed.connected ? "< 5ms" : "~1s"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Advanced tab ── */}
        {activeTab === "advanced" && (
          <PaywallGate requiredPlan="pro" label="Pro Terminal Required" blur={6}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-400 font-bold mb-4">Order Book Depth</p>
                <div className="space-y-1">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const base = btc?.price ?? 67000;
                    const askPrice = (base + (8 - i) * 12).toFixed(2);
                    const size = (Math.random() * 2).toFixed(4);
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-red-400 tabular-nums">{askPrice}</span>
                        <span className="text-gray-500 tabular-nums">{size}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-white/10 my-2 flex justify-between text-[11px]">
                    <span className="text-gray-400">Spread</span>
                    <span className="text-white">${((btc?.price ?? 67000) * 0.0002).toFixed(2)}</span>
                  </div>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const base = btc?.price ?? 67000;
                    const bidPrice = (base - i * 12).toFixed(2);
                    const size = (Math.random() * 2).toFixed(4);
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-brand tabular-nums">{bidPrice}</span>
                        <span className="text-gray-500 tabular-nums">{size}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-400 font-bold mb-4">Recent Trades</p>
                <div className="space-y-1">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const base = btc?.price ?? 67000;
                    const price = (base + (Math.random() * 20 - 10)).toFixed(2);
                    const qty = (Math.random() * 0.1).toFixed(5);
                    const isBuy = Math.random() > 0.5;
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className={isBuy ? "text-brand" : "text-red-400"} >{price}</span>
                        <span className="text-gray-500">{qty}</span>
                        <span className="text-gray-600">{new Date(Date.now() - i * 3000).toLocaleTimeString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </PaywallGate>
        )}

        {/* ── API tab ── */}
        {activeTab === "api" && (
          <PaywallGate requiredPlan="enterprise" label="Enterprise API Access" blur={6}>
            <div className="bg-surface2 border border-white/5 rounded-lg p-5 max-w-2xl">
              <p className="text-gray-400 font-bold mb-4">API Reference</p>
              <div className="space-y-4 text-[11px]">
                {[
                  { method: "GET", path: "/api/prices", desc: "Latest snapshot for all tracked symbols" },
                  { method: "GET", path: "/api/prices?symbol=BTCUSDT", desc: "Single symbol snapshot" },
                  { method: "WSS", path: "wss://api.gravia.io/ws/prices", desc: "Live tick stream (subscribe JSON)" },
                ].map((e) => (
                  <div key={e.path} className="flex gap-3 items-start">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${e.method === "GET" ? "bg-brand/10 text-brand" : "bg-brand2/20 text-brand2"}`}>
                      {e.method}
                    </span>
                    <div>
                      <code className="text-white">{e.path}</code>
                      <p className="text-gray-500 mt-0.5">{e.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 bg-surface3 rounded p-3 border border-white/5">
                  <p className="text-gray-500 mb-2">Authentication header</p>
                  <code className="text-brand text-[10px]">Authorization: Bearer YOUR_API_KEY</code>
                </div>
              </div>
            </div>
          </PaywallGate>
        )}
      </div>

      <TickerStrip feed={feed} />
    </div>
  );
}
