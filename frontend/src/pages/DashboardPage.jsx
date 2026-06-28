import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";
import PaywallGate from "../components/PaywallGate";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmt(n, d) {
  if (n == null) return "—";
  return n >= 1000 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(d ?? 4);
}
function fmtVol(v) {
  if (!v) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  return v.toFixed(0);
}

export default function DashboardPage() {
  const { user, session, isPro, isElite, plan, signOut } = useAuth();
  const navigate = useNavigate();
  const feed = useBinanceFeed();
  const [tab, setTab] = useState("market");

  async function openPortal() {
    const r = await fetch(`${API}/api/portal`, {
      method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  const btc = feed.get("BTCUSDT");

  return (
    <div className="min-h-screen bg-surface font-mono flex flex-col text-xs">
      {/* Status bar */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 border-b border-white/5 px-4 py-1.5 bg-surface2">
        <span className="text-[#00ff88] font-bold">BAYESIAN</span>
        <span className="text-gray-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${feed.connected ? "bg-[#00ff88] animate-pulse" : feed.simulated ? "bg-yellow-400" : "bg-red-400"}`} />
          {feed.connected ? "LIVE" : feed.simulated ? "SIMULATED" : "OFFLINE"}
        </span>
        <span className="text-gray-700">|</span>
        <span>{user?.email}</span>
        <span className="ml-auto text-[#00ff88] uppercase font-bold">{plan}</span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        {["market", "advanced", "api"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition ${tab === t ? "bg-surface3 text-[#00ff88]" : "text-gray-600 hover:text-gray-400"}`}>
            {t}
          </button>
        ))}
        <div className="ml-auto flex gap-3">
          <button onClick={openPortal} className="text-gray-600 hover:text-gray-400 transition text-[10px]">billing</button>
          <button onClick={handleSignOut} className="text-gray-600 hover:text-red-400 transition text-[10px]">sign out</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">

        {tab === "market" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Spotlight */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT"].map(sym => {
                const d = feed.get(sym);
                return (
                  <div key={sym} className="bg-surface2 border border-white/5 rounded-lg p-3">
                    {d ? (
                      <>
                        <p className="text-gray-500 text-[10px] mb-1">{sym}</p>
                        <p className="text-white font-bold text-base">${fmt(d.price)}</p>
                        <p className={`text-[11px] mt-0.5 ${d.change24h >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                          {d.change24h >= 0 ? "▲ +" : "▼ "}{d.change24h.toFixed(2)}%
                        </p>
                      </>
                    ) : <div className="animate-pulse space-y-1"><div className="h-2 bg-white/5 rounded w-16" /><div className="h-4 bg-white/5 rounded w-20" /></div>}
                  </div>
                );
              })}
            </div>

            {/* Market table */}
            <div className="lg:col-span-2 bg-surface2 border border-white/5 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-gray-400 font-bold">Market</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${feed.connected ? "bg-[#00ff88]/10 text-[#00ff88]" : "bg-yellow-400/10 text-yellow-400"}`}>
                  {feed.connected ? "● LIVE" : "○ SIM"}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-normal">Symbol</th>
                    <th className="text-right py-2 px-3 font-normal">Price</th>
                    <th className="text-right py-2 px-3 font-normal">24h %</th>
                    <th className="text-right py-2 px-3 font-normal hidden md:table-cell">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Free: first 2 ungated */}
                  {["BTCUSDT","ETHUSDT"].map(sym => {
                    const d = feed.get(sym);
                    return (
                      <tr key={sym} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-2.5 px-3 text-white font-bold">{sym}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{d ? `$${fmt(d.price)}` : "—"}</td>
                        <td className={`py-2.5 px-3 text-right tabular-nums ${d?.change24h >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                          {d ? `${d.change24h >= 0 ? "▲ +" : "▼ "}${d.change24h.toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-500 hidden md:table-cell">{d ? fmtVol(d.volume24h) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Pro: remaining 4 gated */}
              <PaywallGate requiredPlan="starter" label="Unlock all pairs" blur={4}>
                <table className="w-full text-xs">
                  <tbody>
                    {["BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT"].map(sym => {
                      const d = feed.get(sym);
                      return (
                        <tr key={sym} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="py-2.5 px-3 text-white font-bold">{sym}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{d ? `$${fmt(d.price)}` : "—"}</td>
                          <td className={`py-2.5 px-3 text-right tabular-nums ${d?.change24h >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                            {d ? `${d.change24h >= 0 ? "▲ +" : "▼ "}${d.change24h.toFixed(2)}%` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500 hidden md:table-cell">{d ? fmtVol(d.volume24h) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </PaywallGate>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-3">
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">Your plan</p>
                <p className="text-white font-bold text-lg uppercase">{plan}</p>
                {!isPro && (
                  <button onClick={() => navigate("/pricing")} className="mt-3 w-full bg-[#00ff88] text-black font-bold text-[10px] py-2 rounded hover:opacity-90 transition">
                    Upgrade →
                  </button>
                )}
                {isPro && (
                  <button onClick={openPortal} className="mt-3 w-full border border-white/10 text-gray-400 text-[10px] py-2 rounded hover:border-white/20 transition">
                    Manage billing
                  </button>
                )}
              </div>
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3">Feed</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Source</span><span className="text-white">{feed.connected ? "Binance WS" : "Simulated"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pairs</span><span className="text-white">{feed.getAll().length} active</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Latency</span><span className={feed.connected ? "text-[#00ff88]" : "text-yellow-400"}>{feed.connected ? "< 5ms" : "~1s"}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "advanced" && (
          <PaywallGate requiredPlan="pro" label="Pro Terminal Required" blur={6}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface2 border border-white/5 rounded-lg p-4">
                <p className="text-gray-400 font-bold mb-4">Order Book</p>
                <div className="space-y-1">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const base = btc?.price ?? 67000;
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-red-400 tabular-nums">{(base + (8 - i) * 12).toFixed(2)}</span>
                        <span className="text-gray-500 tabular-nums">{(Math.random() * 2).toFixed(4)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-white/10 my-2" />
                  {Array.from({ length: 8 }).map((_, i) => {
                    const base = btc?.price ?? 67000;
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-[#00ff88] tabular-nums">{(base - i * 12).toFixed(2)}</span>
                        <span className="text-gray-500 tabular-nums">{(Math.random() * 2).toFixed(4)}</span>
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
                    const isBuy = Math.random() > 0.5;
                    return (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className={isBuy ? "text-[#00ff88]" : "text-red-400"}>{(base + (Math.random() * 20 - 10)).toFixed(2)}</span>
                        <span className="text-gray-500">{(Math.random() * 0.1).toFixed(5)}</span>
                        <span className="text-gray-600">{new Date(Date.now() - i * 3000).toLocaleTimeString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </PaywallGate>
        )}

        {tab === "api" && (
          <PaywallGate requiredPlan="elite" label="Elite API Access" blur={6}>
            <div className="bg-surface2 border border-white/5 rounded-lg p-5 max-w-2xl">
              <p className="text-gray-400 font-bold mb-4">API Reference</p>
              <div className="space-y-4 text-[11px]">
                {[
                  { method: "GET",  path: "/api/health",                desc: "Health check + active plans" },
                  { method: "GET",  path: "/api/subscription",          desc: "Current plan status (auth required)" },
                  { method: "POST", path: "/api/checkout",               desc: "Create PayMongo Checkout session" },
                  { method: "POST", path: "/api/portal",                 desc: "Manage billing" },
                  { method: "POST", path: "/api/paymongo/webhook",       desc: "PayMongo webhook receiver" },
                ].map(e => (
                  <div key={e.path} className="flex gap-3 items-start">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${e.method === "GET" ? "bg-[#00ff88]/10 text-[#00ff88]" : "bg-brand2/20 text-brand2"}`}>
                      {e.method}
                    </span>
                    <div>
                      <code className="text-white">{e.path}</code>
                      <p className="text-gray-500 mt-0.5">{e.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 bg-surface3 rounded p-3 border border-white/5">
                  <p className="text-gray-500 mb-2">Auth header</p>
                  <code className="text-[#00ff88] text-[10px]">Authorization: Bearer YOUR_JWT</code>
                </div>
              </div>
            </div>
          </PaywallGate>
        )}
      </div>

      {/* Ticker strip */}
      {feed.getAll().length > 0 && (
        <div className="overflow-hidden bg-surface3 border-t border-white/5 py-1.5 text-[10px] text-gray-500">
          <div className="flex gap-8 whitespace-nowrap" style={{ animation: "tickerScroll 30s linear infinite" }}>
            {[...feed.getAll(), ...feed.getAll()].map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="text-gray-400 font-semibold">{d.symbol.replace("USDT","")}</span>
                <span>${fmt(d.price)}</span>
                <span className={d.change24h >= 0 ? "text-[#00ff88]" : "text-red-400"}>
                  {d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
