import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmt(n) {
  if (!n) return "—";
  return n >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toFixed(4);
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar() {
  const [w, setW] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setW(35), 80);
    const t2 = setTimeout(() => setW(68), 350);
    const t3 = setTimeout(() => setW(100), 750);
    const t4 = setTimeout(() => setDone(true), 1400);
    return () => [t1,t2,t3,t4].forEach(clearTimeout);
  }, []);
  if (done) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] bg-transparent pointer-events-none">
      <div className="h-full transition-all ease-out"
        style={{ width: `${w}%`, background: "linear-gradient(90deg,#00FFC6,#00D4FF)", transitionDuration: w === 35 ? "300ms" : w === 68 ? "400ms" : "200ms" }}
      />
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ up }) {
  const pts = up
    ? "0,9 5,7 10,8 15,5 20,6 25,3 30,4 35,1"
    : "0,1 5,3 10,2 15,5 20,3 25,6 30,5 35,9";
  return (
    <svg width="35" height="10" viewBox="0 0 35 10" className="opacity-50 flex-shrink-0">
      <polyline points={pts} fill="none" stroke={up ? "#00D68F" : "#FF4D4F"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Infinite ticker ───────────────────────────────────────────────────────────
function Ticker({ feed }) {
  const items = feed.getAll();
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="border-b border-white/[0.05] bg-[#07090F]/70 backdrop-blur-sm overflow-hidden py-2 group">
      <div className="ticker-track group-hover:[animation-play-state:paused]">
        {[...row, ...row].map((d, i) => (
          <div key={i} className="inline-flex items-center gap-3 px-6 border-r border-white/[0.05] flex-shrink-0">
            <span className="text-[10px] font-mono text-white/40 tracking-[0.12em] uppercase">{d.symbol.replace("USDT","")}</span>
            <span className="text-[11px] font-mono text-white/80 tabular-nums">${fmt(d.price)}</span>
            <Sparkline up={d.change24h >= 0} />
            <span className={`text-[10px] font-mono tabular-nums font-medium ${d.change24h >= 0 ? "text-success" : "text-danger"}`}>
              {d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fake candlestick chart ────────────────────────────────────────────────────
function FakeChart({ seed = 67400 }) {
  const candles = useMemo(() => {
    let price = seed;
    return Array.from({ length: 36 }, (_, i) => {
      const open = price;
      const change = (Math.sin(i * 0.7) * 0.4 + (Math.random() - 0.47)) * 180;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 60;
      const low  = Math.min(open, close) - Math.random() * 60;
      price = close;
      return { open, close, high, low, bull: close >= open };
    });
  }, []);

  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  const maxP  = Math.max(...highs);
  const minP  = Math.min(...lows);
  const range = maxP - minP || 1;
  const W = 360, H = 110;
  const toY = p => ((maxP - p) / range) * H;
  const toX = i => (i / (candles.length - 1)) * W;

  const linePath = candles.map((c, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(c.close).toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00FFC6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00FFC6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#cg)" />
      {candles.map((c, i) => {
        const x = toX(i);
        const bTop = toY(Math.max(c.open, c.close));
        const bBot = toY(Math.min(c.open, c.close));
        const bH   = Math.max(bBot - bTop, 1);
        const col  = c.bull ? "#00D68F" : "#FF4D4F";
        return (
          <g key={i}>
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={col} strokeWidth="0.6" opacity="0.5" />
            <rect x={x - 3.5} y={bTop} width="7" height={bH} fill={col} opacity="0.85" rx="0.8" />
          </g>
        );
      })}
      <path d={linePath} fill="none" stroke="#00FFC6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// ── Terminal mockup ───────────────────────────────────────────────────────────
function Terminal({ price }) {
  const base = price ?? 67432;
  const { asks, bids, trades } = useMemo(() => {
    const asks = Array.from({ length: 8 }, (_, i) => ({
      price: (base + (8 - i) * 16.5).toFixed(2),
      size:  (0.12 + Math.random() * 1.8).toFixed(4),
      depth: 25 + i * 9,
    }));
    const bids = Array.from({ length: 8 }, (_, i) => ({
      price: (base - i * 15.2).toFixed(2),
      size:  (0.15 + Math.random() * 2.1).toFixed(4),
      depth: 70 - i * 7,
    }));
    const trades = Array.from({ length: 6 }, (_, i) => ({
      price: (base + (Math.random() * 18 - 9)).toFixed(2),
      size:  (Math.random() * 0.08).toFixed(5),
      side:  Math.random() > 0.5,
      ago:   i * 2 + 1,
    }));
    return { asks, bids, trades };
  }, []);

  return (
    <div className="relative w-full max-w-[900px] mx-auto mt-16 md:mt-20">
      {/* ambient glow */}
      <div className="absolute inset-x-0 -top-10 h-[300px] bg-accent/[0.06] blur-[80px] rounded-full pointer-events-none" />

      <div className="relative rounded-2xl border border-white/[0.07] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        style={{ background: "linear-gradient(180deg,#0B1018 0%,#080C14 100%)" }}>

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
          </div>
          <span className="flex-1 text-center text-[10px] font-mono text-white/20 tracking-[0.15em]">GRAVIA TERMINAL  ·  BTC/USDT  ·  PERPETUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[9px] font-mono text-success/70 tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.05]">

          {/* Chart + price */}
          <div className="col-span-2 p-4 flex flex-col gap-3">
            {/* Price row */}
            <div className="flex items-end justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-mono font-bold text-[22px] tabular-nums tracking-tight">${fmt(base)}</span>
                <span className="text-success font-mono text-[11px]">▲ +2.34%</span>
                <span className="text-white/20 font-mono text-[10px]">24h</span>
              </div>
              <div className="flex gap-1">
                {["1m","5m","1h","4h","1D"].map(t => (
                  <button key={t} className={`text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${t === "1h" ? "bg-accent/15 text-accent border border-accent/20" : "text-white/25 hover:text-white/50"}`}>{t}</button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="h-[110px]"><FakeChart seed={base} /></div>

            {/* Volume */}
            <div className="h-6 flex items-end gap-px">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="flex-1 rounded-[1px]"
                  style={{ height: `${15 + Math.random() * 85}%`, background: i % 3 === 0 ? "rgba(255,77,79,0.5)" : "rgba(0,214,143,0.5)" }}
                />
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 pt-1 border-t border-white/[0.05]">
              {[["24h High","$68,942"],["24h Low","$65,210"],["Volume","$2.4B"],["OI","$18.7B"]].map(([l,v]) => (
                <div key={l}>
                  <div className="text-[9px] font-mono text-white/25 tracking-wider mb-0.5">{l}</div>
                  <div className="text-[11px] font-mono text-white/70 tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Order book */}
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-white/25 tracking-widest uppercase">Order Book</span>
              <span className="text-[9px] font-mono text-white/20">0.01</span>
            </div>
            <div className="flex justify-between text-[8px] font-mono text-white/20 px-1 mb-1">
              <span>Price</span><span>Size</span>
            </div>
            {asks.map((a, i) => (
              <div key={i} className="relative flex justify-between text-[9px] font-mono px-1 py-[2px]">
                <div className="absolute inset-y-0 right-0 rounded-[1px] bg-danger/[0.08]" style={{ width: `${a.depth}%` }} />
                <span className="text-danger tabular-nums z-10 relative">{a.price}</span>
                <span className="text-white/35 tabular-nums z-10 relative">{a.size}</span>
              </div>
            ))}
            <div className="flex justify-center py-1.5 my-0.5 border-y border-white/[0.07]">
              <span className="font-mono font-bold text-[11px] text-white tabular-nums">${fmt(base)}</span>
            </div>
            {bids.map((b, i) => (
              <div key={i} className="relative flex justify-between text-[9px] font-mono px-1 py-[2px]">
                <div className="absolute inset-y-0 right-0 rounded-[1px] bg-success/[0.08]" style={{ width: `${b.depth}%` }} />
                <span className="text-success tabular-nums z-10 relative">{b.price}</span>
                <span className="text-white/35 tabular-nums z-10 relative">{b.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade tape */}
        <div className="border-t border-white/[0.05] px-4 py-2.5 grid grid-cols-3 md:grid-cols-6 gap-3">
          {trades.map((t, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-mono tabular-nums ${t.side ? "text-success" : "text-danger"}`}>{t.price}</span>
              <span className="text-[8px] font-mono text-white/25 tabular-nums">{t.size}</span>
              <span className="text-[8px] font-mono text-white/15">{t.ago}s ago</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#050810] to-transparent pointer-events-none rounded-b-2xl" />
    </div>
  );
}

// ── Scroll fade-in ────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShow(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
      style={{ transitionDelay: show ? `${delay}ms` : "0ms" }}>
      {children}
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, tag, delay }) {
  return (
    <FadeUp delay={delay}>
      <div className="group relative glass-card p-6 hover:-translate-y-1 hover:border-white/[0.12] transition-all duration-300 overflow-hidden h-full">
        {/* top shimmer line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex items-start justify-between mb-5">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-base">
            {icon}
          </div>
          <span className="text-[8px] font-mono text-accent/40 tracking-[0.15em] border border-accent/15 rounded px-1.5 py-0.5 bg-accent/[0.04]">{tag}</span>
        </div>
        <h3 className="text-white font-semibold text-sm mb-2 tracking-tight">{title}</h3>
        <p className="text-white/30 text-xs leading-relaxed">{desc}</p>
      </div>
    </FadeUp>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const feed      = useBinanceFeed();
  const [email, setEmail]   = useState("");
  const [wlState, setWlState] = useState("idle");
  const btc = feed.get("BTCUSDT");

  async function joinWaitlist(e) {
    e.preventDefault(); setWlState("loading");
    try {
      const r = await fetch(`${API}/api/waitlist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setWlState(r.ok ? "done" : "error");
    } catch { setWlState("error"); }
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: "#050810" }}>
      {/* Layered backgrounds */}
      <div className="fixed inset-0 pointer-events-none grid-bg opacity-100" />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 55% at 50% -5%, #0C2233 0%, transparent 60%)" }} />

      <ProgressBar />
      <Ticker feed={feed} />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.05]" style={{ background: "rgba(5,8,16,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-[1280px] mx-auto flex items-center h-14 px-6 md:px-10">
          <span className="text-accent font-mono font-bold text-base tracking-tight"
            style={{ textShadow: "0 0 20px rgba(0,255,198,0.35)" }}>GRAVIA</span>
          <div className="ml-auto flex items-center gap-6 text-xs">
            <Link to="/pricing" className="text-white/35 hover:text-white/70 transition-colors">Pricing</Link>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="btn-primary text-xs font-bold px-4 py-1.5">Dashboard →</button>
            ) : (
              <>
                <button onClick={() => navigate("/auth")} className="text-white/35 hover:text-white/70 transition-colors">Sign in</button>
                <button onClick={() => navigate("/auth?tab=signup")} className="btn-primary text-xs font-bold px-4 py-1.5">Start free</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-28 pb-8 text-center">
        {/* Headline glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(0,255,198,0.07) 0%, transparent 70%)" }} />

        {/* Pill */}
        <FadeUp>
          <div className="inline-flex items-center gap-2.5 text-[11px] font-mono border border-white/[0.08] rounded-full px-4 py-1.5 text-white/40 mb-10 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {feed.connected ? "live market data" : feed.simulated ? "simulated feed" : "connecting…"}
          </div>
        </FadeUp>

        {/* Headline */}
        <FadeUp delay={80}>
          <h1 className="text-6xl md:text-[72px] font-bold leading-[1.04] tracking-[-0.02em] text-white mb-6">
            The terminal for<br />
            <span className="gradient-text">serious traders</span>
          </h1>
        </FadeUp>

        {/* Subhead */}
        <FadeUp delay={160}>
          <p className="text-white/35 text-lg md:text-xl max-w-[520px] mx-auto mb-10 leading-relaxed font-light">
            Real-time Binance WebSocket data. Pro-grade terminal UI.<br className="hidden md:block" />
            Stripe billing and Supabase auth — ready to ship.
          </p>
        </FadeUp>

        {/* CTAs */}
        <FadeUp delay={240}>
          <div className="flex gap-3 justify-center flex-wrap mb-4">
            <button onClick={() => navigate("/auth?tab=signup")}
              className="btn-primary px-7 py-3.5 text-sm font-bold">
              Start 14-day free trial →
            </button>
            <button onClick={() => navigate("/pricing")}
              className="px-7 py-3.5 text-sm font-medium border border-white/[0.1] text-white/50 rounded-xl hover:border-white/[0.2] hover:text-white/70 transition-all backdrop-blur-sm">
              View pricing
            </button>
          </div>
          <p className="text-[11px] text-white/20 font-mono">No credit card required · Cancel anytime</p>
        </FadeUp>

        {/* Terminal */}
        <FadeUp delay={320}>
          <Terminal price={btc?.price} />
        </FadeUp>
      </section>

      {/* ── Social proof ── */}
      <FadeUp>
        <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-16 border-t border-white/[0.05]">
          <p className="text-center text-[10px] font-mono text-white/15 tracking-[0.2em] uppercase mb-8">Trusted by traders at</p>
          <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
            {["Citadel", "Jump Trading", "DRW", "Two Sigma", "GSR"].map(name => (
              <span key={name} className="text-white/12 font-bold text-sm tracking-tight hover:text-white/25 transition-colors cursor-default select-none">
                {name}
              </span>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ── Feature cards ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-20 border-t border-white/[0.05]">
        <FadeUp>
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold text-white tracking-tight mb-3">Built for institutional performance</h2>
            <p className="text-white/30 text-sm max-w-md mx-auto">Every millisecond counts. Gravia is engineered from the ground up for speed, reliability, and scale.</p>
          </div>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            delay={0}
            icon="⚡"
            tag="WS STREAM"
            title="Sub-10ms latency"
            desc="Direct Binance WebSocket streams with exponential-backoff reconnect and real-time tick data across 6+ pairs."
          />
          <FeatureCard
            delay={100}
            icon="◈"
            tag="PRO TERMINAL"
            title="Institutional UI"
            desc="Order book depth, candlestick charts, trade tape, and portfolio view — the full terminal experience in your browser."
          />
          <FeatureCard
            delay={200}
            icon="⬡"
            tag="FULL STACK"
            title="Production-ready auth & billing"
            desc="Supabase JWT auth, Stripe Checkout + Portal, and per-feature paywall gates. Ship your SaaS in hours, not weeks."
          />
        </div>
      </section>

      {/* ── Waitlist ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-20 border-t border-white/[0.05]">
        <FadeUp>
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Get early access</h2>
            <p className="text-white/25 text-sm mb-8 font-mono">Join the waitlist — 3 months free on Pro at launch.</p>
            {wlState === "done" ? (
              <p className="text-accent font-mono text-sm">✓ You're on the list.</p>
            ) : (
              <form onSubmit={joinWaitlist} className="flex gap-2">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="flex-1 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/30 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)" }} />
                <button type="submit" disabled={wlState === "loading"}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
                  {wlState === "loading" ? "…" : "Join"}
                </button>
              </form>
            )}
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] px-6 md:px-10 py-8 max-w-[1280px] mx-auto flex justify-between items-center flex-wrap gap-4">
        <span className="text-accent font-mono font-bold text-sm" style={{ textShadow: "0 0 12px rgba(0,255,198,0.3)" }}>GRAVIA</span>
        <span className="text-white/15 text-xs">© 2026 Gravia. All rights reserved.</span>
        <Link to="/pricing" className="text-white/20 text-xs hover:text-white/40 transition-colors">Pricing</Link>
      </footer>
    </div>
  );
}
