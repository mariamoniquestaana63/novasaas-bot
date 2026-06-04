import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmt(n) {
  if (!n) return "—";
  return n >= 1000 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(4);
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const feed = useBinanceFeed();
  const [email, setEmail] = useState("");
  const [wlState, setWlState] = useState("idle");

  async function joinWaitlist(e) {
    e.preventDefault();
    setWlState("loading");
    try {
      const r = await fetch(`${API}/api/waitlist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setWlState(r.ok ? "done" : "error");
    } catch { setWlState("error"); }
  }

  const tickers = feed.getAll();

  return (
    <div className="min-h-screen bg-surface font-mono">
      {tickers.length > 0 && (
        <div className="bg-surface2 border-b border-white/5 py-2 overflow-hidden text-xs">
          <div className="flex gap-10 whitespace-nowrap" style={{ animation: "tickerScroll 30s linear infinite" }}>
            {[...tickers, ...tickers].map((d, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-gray-500">
                <span className="text-white font-bold">{d.symbol.replace("USDT", "")}</span>
                <span>${fmt(d.price)}</span>
                <span className={d.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                  {d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <nav className="flex items-center h-14 px-6 md:px-12 border-b border-white/5 sticky top-0 z-50 bg-surface/90 backdrop-blur">
        <span className="text-[#00ff88] font-bold text-lg" style={{ textShadow: "0 0 12px rgba(0,255,136,0.5)" }}>GRAVIA</span>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <Link to="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
          {user ? (
            <button onClick={() => navigate("/dashboard")} className="bg-[#00ff88] text-black font-bold px-4 py-1.5 rounded">Dashboard →</button>
          ) : (
            <>
              <button onClick={() => navigate("/auth")} className="text-gray-400 hover:text-white transition">Sign in</button>
              <button onClick={() => navigate("/auth?tab=signup")} className="bg-[#00ff88] text-black font-bold px-4 py-1.5 rounded">Start free</button>
            </>
          )}
        </div>
      </nav>
      <section className="px-6 md:px-12 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs bg-surface2 border border-white/10 rounded-full px-3 py-1 text-gray-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse inline-block" />
          {feed.connected ? "live market data" : feed.simulated ? "simulated feed" : "connecting…"}
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          The terminal for<br />
          <span className="text-[#00ff88]" style={{ textShadow: "0 0 30px rgba(0,255,136,0.3)" }}>serious traders</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
          Real-time Binance WebSocket data. Pro-grade terminal UI. Stripe billing and Supabase auth — ready to ship.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => navigate("/auth?tab=signup")} className="bg-[#00ff88] text-black font-bold px-6 py-3 rounded-lg text-sm hover:opacity-90 transition">Start 14-day free trial →</button>
          <button onClick={() => navigate("/pricing")} className="border border-white/10 text-gray-300 px-6 py-3 rounded-lg text-sm hover:border-white/50 transition">View pricing</button>
        </div>
        <div className="mt-14 mx-auto max-w-3xl grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
          {feed.getAll().slice(0, 6).map((d) => (
            <div key={d.symbol} className="bg-surface2 border border-white/5 rounded-xl p-4 hover:border-[#00ff88]/20 transition">
              <div className="text-gray-500 text-[10px] mb-1">{d.symbol}</div>
              <div className="text-white font-bold">${fmt(d.price)}</div>
              <div className={`text-xs mt-0.5 ${d.change24h >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                {d.change24h >= 0 ? "▲ +" : "▼ "}{d.change24h.toFixed(2)}%
              </div>
            </div>
          ))}
          {!feed.getAll().length && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface2 border border-white/5 rounded-xl p-4 animate-pulse">
              <div className="h-2 bg-white/5 rounded w-16 mb-2" />
              <div className="h-4 bg-white/5 rounded w-20 mb-1" />
              <div className="h-2 bg-white/5 rounded w-10" />
            </div>
          ))}
        </div>
      </section>
      <section className="px-6 md:px-12 py-16 border-t border-white/5">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Everything in one stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {[
            { icon: "⚡", title: "Live Binance WebSocket", desc: "Real-time tick data for 6+ pairs with simulated fallback when offline." },
            { icon: "🔐", title: "Supabase Auth", desc: "Email/password sign-up, JWT sessions, RLS-secured data out of the box." },
            { icon: "💳", title: "Stripe Billing", desc: "Checkout, portal, and webhooks. Starter / Pro / Elite plans, 14-day trial." },
            { icon: "🛡️", title: "Paywall Gates", desc: "Per-feature blur overlays. Unlock tiers based on active subscription plan." },
            { icon: "📊", title: "Terminal Dashboard", desc: "Market overview, order book depth, and API tab — all in one dark UI." },
            { icon: "🚀", title: "Vercel + Railway Ready", desc: "Frontend deploys to Vercel. Backend to Railway. One command each." },
          ].map((f) => (
            <div key={f.title} className="bg-surface2 border border-white/5 rounded-xl p-6 hover:border-[#00ff88]/20 transition">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-white font-bold text-sm mb-2">{f.title}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="px-6 md:px-12 py-16 border-t border-white/5">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl font-bold text-white mb-2">Get early access</h2>
          <p className="text-gray-400 text-xs mb-6">Join the waitlist — 3 months free on Pro at launch.</p>
          {wlState === "done" ? (
            <p className="text-[#00ff88] text-sm">✓ You're on the list.</p>
          ) : (
            <form onSubmit={joinWaitlist} className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
                className="flex-1 bg-surface2 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00ff88]/40 transition" />
              <button type="submit" disabled={wlState === "loading"}
                className="bg-[#00ff88] text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-60">
                {wlState === "loading" ? "…" : "Join"}
              </button>
            </form>
          )}
        </div>
      </section>
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 flex justify-between items-center flex-wrap gap-4 text-xs text-gray-600">
        <span className="text-[#00ff88] font-bold">GRAVIA</span>
        <span>© 2026 Gravia. All rights reserved.</span>
        <Link to="/pricing" className="hover:text-gray-400 transition">Pricing</Link>
      </footer>
    </div>
  );
}
