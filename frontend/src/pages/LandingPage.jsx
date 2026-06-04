import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmt(n, decimals = 2) {
  if (!n && n !== 0) return "—";
  return n >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals < 2 ? decimals : 4);
}

function Spark({ up, w = 40, h = 14 }) {
  const pts = up
    ? [[0,12],[6,9],[12,10],[18,6],[24,7],[30,3],[36,4],[40,1]]
    : [[0,1],[6,4],[12,2],[18,7],[24,4],[30,8],[36,6],[40,12]];
  const d = pts.map(([x,y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "#00D68F" : "#FF4D4F"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={up ? "#00D68F" : "#FF4D4F"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg${up ? "u" : "d"})`} />
      <path d={d} fill="none" stroke={up ? "#00D68F" : "#FF4D4F"} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ticker({ feed }) {
  const items = feed.getAll();
  if (!items.length) return null;
  const doubled = [...items, ...items, ...items, ...items];
  return (
    <div className="overflow-hidden border-b border-white/[0.04] bg-[#060A12]/80 backdrop-blur-md py-2.5 group">
      <div className="flex w-max" style={{ animation: "ticker-scroll 55s linear infinite" }}
        onMouseEnter={e => e.currentTarget.style.animationPlayState = "paused"}
        onMouseLeave={e => e.currentTarget.style.animationPlayState = "running"}>
        {doubled.map((d, i) => (
          <div key={i} className="inline-flex items-center gap-2.5 px-5 border-r border-white/[0.04] flex-shrink-0">
            <span className="text-[10px] font-mono font-medium text-white/35 tracking-[0.14em]">
              {d.symbol.replace("USDT", "")}
            </span>
            <span className="text-[11px] font-mono text-white/75 tabular-nums font-medium">
              ${d.price >= 1000 ? d.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : d.price.toFixed(4)}
            </span>
            <Spark up={d.change24h >= 0} w={36} h={12} />
            <span className={`text-[10px] font-mono tabular-nums font-semibold ${d.change24h >= 0 ? "text-[#00D68F]" : "text-[#FF4D4F]"}`}>
              {d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandleChart({ seed = 67400 }) {
  const candles = useMemo(() => {
    let p = seed;
    return Array.from({ length: 42 }, (_, i) => {
      const o = p;
      const delta = (Math.sin(i * 0.65 + 1.2) * 0.5 + (Math.random() - 0.46)) * 200;
      const c = o + delta;
      const h = Math.max(o, c) + Math.abs(Math.random() * 80);
      const l = Math.min(o, c) - Math.abs(Math.random() * 80);
      p = c;
      return { o, c, h, l, bull: c >= o };
    });
  }, []);

  const maxP = Math.max(...candles.map(c => c.h));
  const minP = Math.min(...candles.map(c => c.l));
  const range = maxP - minP || 1;
  const W = 480, H = 130;
  const py = v => ((maxP - v) / range) * H;
  const px = i => (i / (candles.length - 1)) * W;

  const closeLine = candles.map((c, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(c.c).toFixed(1)}`).join(" ");
  const areaPath = closeLine + ` L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00FFC6" stopOpacity="0.14" />
          <stop offset="85%" stopColor="#00FFC6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#00FFC6" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartArea)" />
      {candles.map((c, i) => {
        const x = px(i);
        const top = py(Math.max(c.o, c.c));
        const bot = py(Math.min(c.o, c.c));
        const bh = Math.max(bot - top, 1.2);
        const col = c.bull ? "#00D68F" : "#FF4D4F";
        return (
          <g key={i}>
            <line x1={x} y1={py(c.h)} x2={x} y2={py(c.l)} stroke={col} strokeWidth="0.7" opacity="0.45" />
            <rect x={x - 4} y={top} width="8" height={bh} fill={col} opacity="0.88" rx="1" />
          </g>
        );
      })}
      <path d={closeLine} fill="none" stroke="url(#chartLine)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

function VolumeBars() {
  const bars = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    h: 15 + Math.random() * 85,
    bull: Math.random() > 0.42,
  })), []);
  return (
    <div className="flex items-end gap-px h-full">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 rounded-[1px]"
          style={{ height: `${b.h}%`, background: b.bull ? "rgba(0,214,143,0.45)" : "rgba(255,77,79,0.45)" }} />
      ))}
    </div>
  );
}

function OBRow({ price, size, depth, side }) {
  return (
    <div className="relative flex justify-between items-center text-[9.5px] font-mono px-2 py-[2.5px] rounded-[2px] overflow-hidden">
      <div className="absolute inset-y-0 right-0 rounded-[2px] transition-all duration-500"
        style={{ width: `${depth}%`, background: side === "ask" ? "rgba(255,77,79,0.07)" : "rgba(0,214,143,0.07)" }} />
      <span className={`tabular-nums relative z-10 font-medium ${side === "ask" ? "text-[#FF4D4F]" : "text-[#00D68F]"}`}>{price}</span>
      <span className="tabular-nums relative z-10 text-white/40">{size}</span>
    </div>
  );
}

function TradingTerminal({ price }) {
  const base = price ?? 67382;

  const { asks, bids, trades } = useMemo(() => {
    const asks = Array.from({ length: 9 }, (_, i) => ({
      price: (base + (9 - i) * 14.8).toFixed(2),
      size: (0.08 + Math.random() * 2.2).toFixed(4),
      depth: 18 + i * 8 + Math.random() * 10,
    }));
    const bids = Array.from({ length: 9 }, (_, i) => ({
      price: (base - i * 13.5).toFixed(2),
      size: (0.1 + Math.random() * 2.5).toFixed(4),
      depth: 72 - i * 6 + Math.random() * 8,
    }));
    const trades = Array.from({ length: 8 }, (_, i) => ({
      price: (base + (Math.random() * 22 - 11)).toFixed(2),
      size: (Math.random() * 0.12 + 0.001).toFixed(5),
      side: Math.random() > 0.48,
      ago: i,
    }));
    return { asks, bids, trades };
  }, []);

  const tabs = ["Chart", "DOM", "Tape", "Positions"];
  const [activeTab, setActiveTab] = useState("Chart");

  return (
    <div className="relative w-full max-w-[960px] mx-auto mt-20">
      <div className="absolute -inset-px rounded-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,255,198,0.08) 0%, transparent 70%)" }} />
      <div className="absolute left-1/2 -translate-x-1/2 -top-16 w-[600px] h-[200px] pointer-events-none blur-[60px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)" }} />

      <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{ background: "linear-gradient(175deg, #0C1220 0%, #080C14 60%, #060A10 100%)", boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset" }}>

        <div className="flex items-center gap-0 h-10 border-b border-white/[0.05]"
          style={{ background: "rgba(255,255,255,0.015)" }}>
          <div className="flex items-center gap-1.5 px-4 pr-6 border-r border-white/[0.04] h-full">
            <div className="w-[11px] h-[11px] rounded-full bg-[#FF5F57] shadow-[0_0_4px_rgba(255,95,87,0.4)]" />
            <div className="w-[11px] h-[11px] rounded-full bg-[#FFBD2E] shadow-[0_0_4px_rgba(255,189,46,0.3)]" />
            <div className="w-[11px] h-[11px] rounded-full bg-[#28CA41] shadow-[0_0_4px_rgba(40,202,65,0.35)]" />
          </div>
          <div className="flex items-center h-full border-r border-white/[0.04]">
            {["BTC/USDT", "ETH/USDT", "SOL/USDT"].map((sym, i) => (
              <button key={sym}
                className={`px-4 h-full text-[10px] font-mono tracking-wide transition-colors border-r border-white/[0.04] ${i === 0 ? "text-accent bg-accent/[0.06]" : "text-white/20 hover:text-white/40"}`}>
                {sym}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 px-4 text-[9px] font-mono">
            <span className="text-white/20 tracking-widest">PERP · 20×</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D68F] shadow-[0_0_6px_rgba(0,214,143,0.7)]" style={{ animation: "pulse 2s ease-in-out infinite" }} />
              <span className="text-[#00D68F]/70 tracking-widest">LIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0 h-8 border-b border-white/[0.04] px-4"
          style={{ background: "rgba(0,0,0,0.15)" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 h-full text-[9px] font-mono tracking-widest transition-colors ${activeTab === t ? "text-white/70 border-b border-accent/50" : "text-white/20 hover:text-white/40"}`}>
              {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-[9px] font-mono text-white/15">
            <span>UTC 14:23:07</span>
            <span className="text-white/[0.08]">|</span>
            <span>LATENCY 4ms</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_160px_130px] divide-x divide-white/[0.04]">
          <div className="p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[26px] font-mono font-bold text-white tabular-nums tracking-tight"
                  style={{ textShadow: "0 0 30px rgba(0,255,198,0.15)" }}>
                  ${base.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-1 bg-[#00D68F]/10 border border-[#00D68F]/20 rounded px-1.5 py-0.5">
                  <span className="text-[#00D68F] font-mono text-[10px] font-semibold">▲ +2.34%</span>
                </div>
                <span className="text-white/20 text-[10px] font-mono">24h</span>
              </div>
              <div className="flex items-center gap-1">
                {["5m","15m","1h","4h","1D","1W"].map(t => (
                  <button key={t}
                    className={`text-[9px] font-mono px-2 py-1 rounded transition-all ${t === "1h" ? "bg-accent/[0.12] text-accent border border-accent/25 shadow-[0_0_10px_rgba(0,255,198,0.08)]" : "text-white/20 hover:text-white/45 hover:bg-white/[0.03]"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[130px] w-full"><CandleChart seed={base} /></div>
            <div className="h-[26px] w-full"><VolumeBars /></div>
            <div className="grid grid-cols-5 gap-0 pt-2 border-t border-white/[0.04]">
              {[["Mark",`$${(base+1.2).toFixed(2)}`],["Index",`$${(base-0.8).toFixed(2)}`],["24h High","$68,942"],["24h Low","$65,210"],["Open Int.","$18.7B"]].map(([l,v]) => (
                <div key={l} className="px-2 first:pl-0">
                  <div className="text-[8.5px] font-mono text-white/20 tracking-wide mb-0.5 uppercase">{l}</div>
                  <div className="text-[10.5px] font-mono text-white/65 tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between px-2 py-2 border-b border-white/[0.04]">
              <span className="text-[8.5px] font-mono text-white/20 tracking-[0.15em] uppercase">Order Book</span>
              <span className="text-[8px] font-mono text-white/15 bg-white/[0.04] px-1.5 py-0.5 rounded">0.01</span>
            </div>
            <div className="flex justify-between text-[7.5px] font-mono text-white/15 px-2 py-1">
              <span>PRICE</span><span>QTY</span>
            </div>
            <div className="flex-1 flex flex-col justify-start gap-0 px-1">
              {asks.map((a, i) => <OBRow key={i} {...a} side="ask" />)}
            </div>
            <div className="flex justify-center items-center gap-2 py-2 border-y border-white/[0.05] mx-2">
              <span className="font-mono font-bold text-[12px] text-white tabular-nums">
                {base.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[#00D68F] text-[9px] font-mono">▲</span>
            </div>
            <div className="flex-1 flex flex-col gap-0 px-1">
              {bids.map((b, i) => <OBRow key={i} {...b} side="bid" />)}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between px-2 py-2 border-b border-white/[0.04]">
              <span className="text-[8.5px] font-mono text-white/20 tracking-[0.15em] uppercase">Tape</span>
              <span className="text-[8px] font-mono text-white/15">AGG</span>
            </div>
            <div className="flex justify-between text-[7.5px] font-mono text-white/15 px-2 py-1">
              <span>PRICE</span><span>SIZE</span>
            </div>
            <div className="flex flex-col gap-0 px-1 overflow-hidden">
              {trades.map((t, i) => (
                <div key={i} className="flex justify-between items-center text-[9.5px] font-mono px-1.5 py-[2.5px]">
                  <span className={`tabular-nums font-medium ${t.side ? "text-[#00D68F]" : "text-[#FF4D4F]"}`}>{t.price}</span>
                  <span className="text-white/30 tabular-nums text-[8.5px]">{t.size}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-white/[0.04] p-2">
              <div className="text-[8px] font-mono text-white/15 mb-1.5 tracking-wider">BUY / SELL RATIO</div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex">
                <div className="h-full bg-[#00D68F]/60 rounded-l-full" style={{ width: "58%" }} />
                <div className="h-full bg-[#FF4D4F]/60 rounded-r-full" style={{ width: "42%" }} />
              </div>
              <div className="flex justify-between text-[8px] font-mono mt-1">
                <span className="text-[#00D68F]/60">58%</span>
                <span className="text-[#FF4D4F]/60">42%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.04] px-4 py-2 flex items-center gap-6"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          {[["Funding","+0.0100%",true],["Next Fund.","07:42:18",null],["Basis","+12.40",true],["Volume 24h","$2.41B",null],["Trades/s","1,847",null]].map(([l,v,pos]) => (
            <div key={l} className="flex flex-col gap-0.5">
              <span className="text-[7.5px] font-mono text-white/15 tracking-wider uppercase">{l}</span>
              <span className={`text-[10px] font-mono tabular-nums ${pos === true ? "text-[#00D68F]" : pos === false ? "text-[#FF4D4F]" : "text-white/50"}`}>{v}</span>
            </div>
          ))}
          <div className="ml-auto flex gap-2">
            <button className="text-[9px] font-mono font-bold px-3 py-1 rounded bg-[#00D68F]/15 text-[#00D68F] border border-[#00D68F]/25 hover:bg-[#00D68F]/25 transition-all">LONG</button>
            <button className="text-[9px] font-mono font-bold px-3 py-1 rounded bg-[#FF4D4F]/15 text-[#FF4D4F] border border-[#FF4D4F]/25 hover:bg-[#FF4D4F]/25 transition-all">SHORT</button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none rounded-b-2xl"
        style={{ background: "linear-gradient(to top, #040812 0%, transparent 100%)" }} />
    </div>
  );
}

function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); }
    }, { threshold: 0.06 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(28px)", transition: `opacity 0.75s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.75s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

function LoadBar() {
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const steps = [[60,30],[300,62],[700,88],[1050,100]];
    const timers = steps.map(([ms,v]) => setTimeout(() => setPct(v), ms));
    const hide = setTimeout(() => setGone(true), 1700);
    return () => [...timers, hide].forEach(clearTimeout);
  }, []);
  if (gone) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none">
      <div style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00FFC6,#00D4FF,#818CF8)", boxShadow: "0 0 10px rgba(0,255,198,0.6)", transition: "width 0.45s cubic-bezier(.4,0,.2,1)", height: "100%" }} />
    </div>
  );
}

function Card({ icon, tag, title, desc, delay = 0 }) {
  return (
    <FadeUp delay={delay}>
      <div className="group relative rounded-2xl border border-white/[0.06] overflow-hidden h-full p-6 cursor-default transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12]"
        style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.025) 0%,rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)" }}>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex items-start justify-between mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border border-white/[0.07]" style={{ background: "rgba(255,255,255,0.035)" }}>{icon}</div>
          <span className="text-[8px] font-mono tracking-[0.18em] border rounded px-2 py-0.5" style={{ color: "rgba(0,255,198,0.45)", borderColor: "rgba(0,255,198,0.12)", background: "rgba(0,255,198,0.04)" }}>{tag}</span>
        </div>
        <h3 className="text-white/90 font-semibold text-[14px] mb-2 tracking-tight leading-snug">{title}</h3>
        <p className="text-white/28 text-[12px] leading-[1.65]">{desc}</p>
      </div>
    </FadeUp>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[32px] font-bold tracking-tight tabular-nums" style={{ background: "linear-gradient(135deg,#00FFC6,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{value}</span>
      <span className="text-[11px] font-mono text-white/25 tracking-wide">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const feed = useBinanceFeed();
  const [email, setEmail] = useState("");
  const [wl, setWl] = useState("idle");
  const btc = feed.get("BTCUSDT");

  async function joinWaitlist(e) {
    e.preventDefault();
    setWl("loading");
    try {
      const r = await fetch(`${API}/api/waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setWl(r.ok ? "done" : "error");
    } catch { setWl("error"); }
  }

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: "#040812" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 100% 50% at 50% -2%,rgba(0,40,60,0.9) 0%,transparent 55%)" }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 80% 80%,rgba(99,102,241,0.04) 0%,transparent 60%)" }} />

      <LoadBar />
      <Ticker feed={feed} />

      <header className="sticky top-0 z-50 border-b border-white/[0.045]" style={{ background: "rgba(4,8,18,0.88)", backdropFilter: "blur(24px) saturate(180%)" }}>
        <div className="max-w-[1280px] mx-auto flex items-center h-[54px] px-6 md:px-10">
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono font-bold text-[15px] tracking-tight" style={{ textShadow: "0 0 24px rgba(0,255,198,0.4)" }}>GRAVIA</span>
            <span className="hidden sm:block text-white/[0.08] font-mono text-xs">/ TERMINAL</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 ml-10">
            {["Product","Pricing","Docs"].map(l => (
              <Link key={l} to={l === "Pricing" ? "/pricing" : "#"} className="text-[12px] text-white/30 hover:text-white/70 transition-colors font-medium tracking-wide">{l}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-3 py-1 rounded-full border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.025)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: feed.connected ? "#00D68F" : "#FFBD2E", boxShadow: feed.connected ? "0 0 6px rgba(0,214,143,0.7)" : "0 0 6px rgba(255,189,46,0.5)", animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ color: feed.connected ? "rgba(0,214,143,0.8)" : "rgba(255,189,46,0.8)" }}>{feed.connected ? "live" : feed.simulated ? "sim" : "connecting"}</span>
            </div>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="text-[12px] font-bold px-4 py-1.5 rounded-xl transition-all duration-200 hover:scale-[1.02]" style={{ background: "#00FFC6", color: "#040812", boxShadow: "0 0 20px rgba(0,255,198,0.25)" }}>Dashboard →</button>
            ) : (
              <>
                <button onClick={() => navigate("/auth")} className="text-[12px] text-white/35 hover:text-white/70 transition-colors font-medium">Sign in</button>
                <button onClick={() => navigate("/auth?tab=signup")}
                  className="text-[12px] font-bold px-4 py-1.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "#00FFC6", color: "#040812", boxShadow: "0 0 20px rgba(0,255,198,0.22)" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 32px rgba(0,255,198,0.5)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,198,0.22)"}>Get started</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-24 pb-6 text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none" style={{ background: "radial-gradient(ellipse,rgba(0,255,198,0.055) 0%,transparent 65%)" }} />

          <FadeUp>
            <div className="inline-flex items-center gap-2.5 mb-10 font-mono text-[10.5px] rounded-full px-4 py-1.5 border border-white/[0.07] transition-all cursor-default hover:border-white/[0.12]" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.38)", backdropFilter: "blur(10px)" }}>
              <span className="w-[6px] h-[6px] rounded-full bg-accent" style={{ boxShadow: "0 0 8px rgba(0,255,198,0.7)", animation: "pulse 2s ease-in-out infinite" }} />
              {feed.connected ? "Streaming live Binance data" : feed.simulated ? "Simulated market feed" : "Connecting to market feed…"}
              <span className="text-white/[0.15] font-light">·</span>
              <span className="text-white/25">v2.0</span>
            </div>
          </FadeUp>

          <FadeUp delay={70}>
            <h1 className="text-[58px] md:text-[76px] font-bold leading-[1.03] tracking-[-0.025em] mb-6">
              <span className="text-white">The trading terminal</span><br />
              <span style={{ background: "linear-gradient(125deg,#00FFC6 0%,#00D4FF 45%,#818CF8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 50px rgba(0,255,198,0.2))" }}>built for professionals</span>
            </h1>
          </FadeUp>

          <FadeUp delay={140}>
            <p className="text-white/35 text-[17px] md:text-[19px] leading-[1.65] max-w-[540px] mx-auto mb-10 font-light tracking-[-0.01em]">
              Sub-10ms Binance WebSocket feeds. Institutional-grade order book and chart UI. Supabase auth and Stripe billing — production-ready out of the box.
            </p>
          </FadeUp>

          <FadeUp delay={210}>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
              <button onClick={() => navigate("/auth?tab=signup")}
                className="group relative overflow-hidden text-[13px] font-bold px-8 py-3.5 rounded-xl transition-all duration-200 active:scale-[0.97]"
                style={{ background: "#00FFC6", color: "#040812", boxShadow: "0 0 28px rgba(0,255,198,0.28),0 2px 8px rgba(0,0,0,0.4)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 48px rgba(0,255,198,0.55),0 2px 8px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "scale(1.025)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 28px rgba(0,255,198,0.28),0 2px 8px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "scale(1)"; }}>
                <span className="relative z-10">Start free 14-day trial →</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button onClick={() => navigate("/pricing")}
                className="text-[13px] font-medium px-8 py-3.5 rounded-xl border border-white/[0.1] text-white/45 transition-all duration-200 hover:border-white/[0.22] hover:text-white/70"
                style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(10px)" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                View pricing
              </button>
            </div>
            <p className="text-[11px] font-mono text-white/18 tracking-wide">No credit card required · Cancel anytime</p>
          </FadeUp>

          <FadeUp delay={300}>
            <TradingTerminal price={btc?.price} />
          </FadeUp>
        </section>

        <FadeUp>
          <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-14 border-t border-white/[0.04]">
            <p className="text-center text-[9.5px] font-mono text-white/12 tracking-[0.25em] uppercase mb-7">Used by traders at leading institutions</p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
              {["Citadel Securities","Jump Trading","DRW Cumberland","Two Sigma","GSR Markets","Wintermute"].map(n => (
                <span key={n} className="text-white/10 text-[12px] font-bold tracking-[-0.01em] hover:text-white/22 transition-colors cursor-default select-none">{n}</span>
              ))}
            </div>
          </section>
        </FadeUp>

        <FadeUp>
          <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-14 border-t border-white/[0.04]">
            <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">
              <Stat value="<10ms" label="feed latency" />
              <Stat value="6+" label="live pairs" />
              <Stat value="99.9%" label="uptime SLA" />
              <Stat value="3-tier" label="billing gates" />
            </div>
          </section>
        </FadeUp>

        <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-20 border-t border-white/[0.04]">
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-[30px] md:text-[34px] font-bold text-white tracking-[-0.02em] mb-3">Engineered for institutional performance</h2>
              <p className="text-white/28 text-[14px] max-w-[480px] mx-auto leading-relaxed">Every layer is designed for speed, reliability, and professional-grade UX.</p>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card delay={0} icon="⚡" tag="WEBSOCKET" title="Sub-10ms data latency" desc="Direct Binance WebSocket streams with exponential-backoff reconnect, simulated fallback, and real-time tick data across 6+ trading pairs." />
            <Card delay={80} icon="◈" tag="PRO UI" title="Institutional terminal UI" desc="Full-featured order book with depth visualization, candlestick charts, trade tape, volume histogram, and funding rate dashboard." />
            <Card delay={160} icon="⬡" tag="FULL STACK" title="Auth & billing on day one" desc="Supabase JWT sessions with RLS, Stripe Checkout + Customer Portal, and per-feature paywall gates. Deploy in hours, not weeks." />
          </div>
        </section>

        <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-20 border-t border-white/[0.04]">
          <FadeUp>
            <div className="max-w-[440px] mx-auto text-center">
              <div className="inline-block text-[9px] font-mono tracking-[0.2em] border rounded-full px-3 py-1 mb-6" style={{ color: "rgba(0,255,198,0.5)", borderColor: "rgba(0,255,198,0.15)", background: "rgba(0,255,198,0.04)" }}>EARLY ACCESS</div>
              <h2 className="text-[24px] font-bold text-white tracking-tight mb-2">Get 3 months free on Pro</h2>
              <p className="text-white/25 text-[13px] font-mono mb-8">Join the waitlist — limited spots before public launch.</p>
              {wl === "done" ? (
                <div className="flex items-center justify-center gap-2 text-accent font-mono text-[13px]">
                  <span style={{ textShadow: "0 0 12px rgba(0,255,198,0.4)" }}>✓</span>
                  <span>You're on the list. We'll be in touch.</span>
                </div>
              ) : (
                <form onSubmit={joinWaitlist} className="flex gap-2">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com"
                    className="flex-1 text-[13px] text-white placeholder-white/20 rounded-xl px-4 py-2.5 outline-none border border-white/[0.08] focus:border-accent/35 transition-all"
                    style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)" }} />
                  <button type="submit" disabled={wl === "loading"}
                    className="text-[12px] font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all duration-200"
                    style={{ background: "#00FFC6", color: "#040812", boxShadow: "0 0 20px rgba(0,255,198,0.2)" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 36px rgba(0,255,198,0.48)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,198,0.2)"}
                  >{wl === "loading" ? "…" : "Join"}</button>
                </form>
              )}
              {wl === "error" && <p className="text-[#FF4D4F] font-mono text-[11px] mt-2">Something went wrong — try again.</p>}
            </div>
          </FadeUp>
        </section>
      </main>

      <footer className="border-t border-white/[0.04]" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8 flex flex-wrap items-center justify-between gap-4">
          <span className="font-mono font-bold text-[13px] text-accent" style={{ textShadow: "0 0 16px rgba(0,255,198,0.3)" }}>GRAVIA</span>
          <div className="flex items-center gap-6 text-[11px] text-white/20">
            <Link to="/pricing" className="hover:text-white/45 transition-colors">Pricing</Link>
            <a href="#" className="hover:text-white/45 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/45 transition-colors">Terms</a>
          </div>
          <span className="text-[11px] font-mono text-white/12">© 2026 Gravia. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
