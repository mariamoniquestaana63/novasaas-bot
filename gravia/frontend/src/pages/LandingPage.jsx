import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBinanceFeed } from "../hooks/useBinanceFeed";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmt(n) {
  if (!n) return "—";
  return n >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toFixed(4);
}

function TickerBar({ feed }) {
  const items = feed.getAll();
  if (!items.length) return null;
  const doubled = [...items, ...items];

  return (
    <div className="bg-surface2 border-b border-white/5 py-2 overflow-hidden text-xs font-mono">
      <div className="flex gap-10 animate-ticker-scroll whitespace-nowrap">
        {doubled.map((d, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-gray-400">
            <span className="text-white font-semibold">{d.symbol.replace("USDT", "")}</span>
            <span>${fmt(d.price)}</span>
            <span className={d.change24h >= 0 ? "text-brand" : "text-red-400"}>
              {d.change24h >= 0 ? "▲" : "▼"}{Math.abs(d.change24h).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feed = useBinanceFeed();
  const [email, setEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState("idle"); // idle | loading | done | error

  async function joinWaitlist(e) {
    e.preventDefault();
    if (!email) return;
    setWaitlistState("loading");
    try {
      const res = await fetch(`${API}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setWaitlistState(res.ok ? "done" : "error");
    } catch { setWaitlistState("error"); }
  }

  const features = [
    { icon: "⚡", title: "Real-Time WebSocket Feed", desc: "Binance stream with <5ms latency. 6 pairs on Pro, unlimited on Enterprise." },
    { icon: "📊", title: "Terminal Dashboard", desc: "Bloomberg-style interface. Price tables, charts, depth, and ticker — all live." },
    { icon: "🔐", title: "Supabase Auth", desc: "Email/password and magic link. JWT sessions with secure RLS-enforced data." },
    { icon: "💳", title: "Stripe Subscriptions", desc: "Monthly/annual billing, free trial, self-serve portal. No friction." },
    { icon: "🛡️", title: "Paywall Per Feature", desc: "Fine-grained access control per plan. Free preview, Pro unlocks, Enterprise all-in." },
    { icon: "📡", title: "Simulated Fallback", desc: "Realistic random-walk simulation when WS is unavailable. No blank screens." },
  ];

  return (
    <div className="min-h-screen bg-surface font-mono">
      <TickerBar feed={feed} />

      {/* Nav */}
      <nav className="flex items-center h-14 px-6 md:px-12 border-b border-white/5 sticky top-0 z-50 bg-surface/90 backdrop-blur">
        <span className="text-brand font-bold text-lg glow-brand">GRAVIA</span>
        <span className="text-gray-600 text-xs ml-2">terminal</span>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link to="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
          {user ? (
            <button onClick={() => navigate("/dashboard")} className="bg-brand text-black font-bold px-4 py-1.5 rounded text-xs hover:opacity-90 transition">
              Dashboard →
            </button>
          ) : (
            <>
              <button onClick={() => navigate("/auth")} className="text-gray-400 hover:text-white transition">Login</button>
              <button onClick={() => navigate("/auth?tab=signup")} className="bg-brand text-black font-bold px-4 py-1.5 rounded text-xs hover:opacity-90 transition">
                Start free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-20 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand/5 rounded-full blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 text-xs bg-surface2 border border-white/10 rounded-full px-3 py-1 text-gray-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow inline-block" />
          {feed.connected ? "live market data" : feed.simulated ? "simulated feed" : "connecting…"}
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          A terminal for<br />
          <span className="text-brand glow-brand">serious traders</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Real-time Binance WebSocket data. Pro-grade terminal UI. Auth, paywalls, and billing — all wired up out of the box.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => navigate("/auth?tab=signup")} className="bg-brand text-black font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm">
            Start free trial →
          </button>
          <button onClick={() => navigate("/dashboard")} className="border border-white/10 text-gray-300 px-6 py-3 rounded-lg hover:border-brand/40 hover:text-white transition text-sm">
            View terminal
          </button>
        </div>

        {/* Mini terminal preview */}
        <div className="mt-14 mx-auto max-w-3xl bg-surface2 border border-white/8 rounded-xl overflow-hidden glow-box">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="text-gray-600 text-xs ml-2">gravia — terminal</span>
          </div>
          <div className="p-5 text-left text-xs grid grid-cols-2 md:grid-cols-3 gap-3">
            {feed.getAll().slice(0, 6).map((d) => (
              <div key={d.symbol} className="bg-surface3 rounded p-3 border border-white/5">
                <div className="text-gray-500 text-[10px] mb-1">{d.symbol}</div>
                <div className="text-white font-bold text-sm">${fmt(d.price)}</div>
                <div className={`text-[11px] mt-0.5 ${d.change24h >= 0 ? "text-brand" : "text-red-400"}`}>
                  {d.change24h >= 0 ? "▲ +" : "▼ "}{d.change24h.toFixed(2)}%
                </div>
              </div>
            ))}
            {feed.getAll().length === 0 && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface3 rounded p-3 border border-white/5 animate-pulse">
                <div className="h-2 bg-white/10 rounded w-16 mb-2" />
                <div className="h-4 bg-white/10 rounded w-20 mb-1" />
                <div className="h-2 bg-white/5 rounded w-12" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-16 border-t border-white/5">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3 text-center">Platform</p>
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">Everything in one stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f) => (
            <div key={f.title} className="bg-surface2 border border-white/5 rounded-xl p-6 hover:border-brand/20 transition">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-white font-bold text-sm mb-2">{f.title}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="px-6 md:px-12 py-16 border-t border-white/5 text-center">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Start free, scale up</h2>
        <p className="text-gray-400 text-sm mb-8">14-day free trial on all paid plans. No card needed to start.</p>
        <button onClick={() => navigate("/pricing")} className="bg-brand text-black font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm">
          See plans →
        </button>
      </section>

      {/* Waitlist */}
      <section className="px-6 md:px-12 py-16 border-t border-white/5">
        <div className="max-w-md mx-auto text-center">
          <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Early Access</p>
          <h2 className="text-xl font-bold text-white mb-2">Get notified at launch</h2>
          <p className="text-gray-400 text-xs mb-6">Join the waitlist for early access and 3 months free on Pro.</p>
          {waitlistState === "done" ? (
            <p className="text-brand text-sm">✓ You're on the list. We'll be in touch.</p>
          ) : (
            <form onSubmit={joinWaitlist} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-surface2 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand/40 transition"
              />
              <button type="submit" disabled={waitlistState === "loading"} className="bg-brand text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-60">
                {waitlistState === "loading" ? "…" : "Join"}
              </button>
            </form>
          )}
          {waitlistState === "error" && <p className="text-red-400 text-xs mt-2">Something went wrong. Try again.</p>}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-8 flex justify-between items-center flex-wrap gap-4 text-xs text-gray-600">
        <span className="text-brand font-bold">GRAVIA</span>
        <span>© 2026 Gravia. All rights reserved.</span>
        <div className="flex gap-6">
          <Link to="/pricing" className="hover:text-gray-400 transition">Pricing</Link>
          <a href="mailto:support@gravia.io" className="hover:text-gray-400 transition">Support</a>
        </div>
      </footer>
    </div>
  );
}
