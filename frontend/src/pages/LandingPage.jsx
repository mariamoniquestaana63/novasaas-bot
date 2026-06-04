import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useBinanceFeed } from "../hooks/useBinanceFeed";

const API = import.meta.env.VITE_API_URL ?? "/api";

function fmtPrice(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(2);
  return n.toFixed(4);
}
function fmtPct(n) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function ProgressBar() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => setVisible(false), 1650); return () => clearTimeout(t); }, []);
  if (!visible) return null;
  return <div className="load-bar" />;
}

function Sparkline({ up, width = 44, height = 16 }) {
  const points = up
    ? "0,14 7,10 14,12 21,7 28,8 35,4 42,5 44,2"
    : "0,2  7,5  14,3  21,8 28,5 35,9 42,7 44,14";
  const areaPoints = `0,${height} ` + points + ` ${width},${height}`;
  const color = up ? "#00D68F" : "#FF4D4F";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0 opacity-70">
      <defs>
        <linearGradient id={`spk-${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spk-${up ? "u" : "d"})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const COIN_ORDER = ["BTCUSDT","ETHUSDT","BNBUSDT","XRPUSDT","ADAUSDT","SOLUSDT"];

function Ticker({ feed }) {
  const all = feed.getAll();
  const ordered = COIN_ORDER.map(sym => all.find(d => d.symbol === sym)).filter(Boolean);
  if (!ordered.length) return null;
  const items = [...ordered, ...ordered, ...ordered, ...ordered];
  return (
    <div className="relative overflow-hidden border-b border-white/[0.045] py-2.5"
      style={{ background: "rgba(5,8,16,0.9)", backdropFilter: "blur(12px)" }}>
      <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right,#050810,transparent)" }} />
      <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left,#050810,transparent)" }} />
      <div className="ticker-track">
        {items.map((d, i) => {
          const up = d.change24h >= 0;
          return (
            <div key={i} className="inline-flex items-center gap-3 px-6 border-r border-white/[0.045] select-none">
              <span className="text-[10px] font-mono font-semibold text-white/35 tracking-[0.14em] uppercase w-12 flex-shrink-0">{d.symbol.replace("USDT","")}</span>
              <span className="text-[11.5px] font-mono font-medium text-white/85 tabular-nums">${fmtPrice(d.price)}</span>
              <Sparkline up={up} />
              <span className={`text-[10.5px] font-mono font-semibold tabular-nums ${up ? "text-success" : "text-danger"}`}>{fmtPct(d.change24h)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setOn(true); io.disconnect(); } },
      { threshold: 0.07 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`fade-up${on ? " visible" : ""} ${className}`}
      style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}>
      {children}
    </div>
  );
}

function CandleChart({ seed = 67400 }) {
  const candles = useMemo(() => {
    let p = seed;
    return Array.from({ length: 48 }, (_, i) => {
      const o = p;
      const move = (Math.sin(i * 0.72 + 1.1) * 0.45 + (Math.random() - 0.455)) * 220;
      const c = o + move;
      const h = Math.max(o, c) + Math.random() * 90;
      const l = Math.min(o, c) - Math.random() * 90;
      p = c;
      return { o, c, h, l, bull: c >= o };
    });
  }, []);
  const allH = candles.map(x => x.h), allL = candles.map(x => x.l);
  const maxP = Math.max(...allH), minP = Math.min(...allL), range = maxP - minP || 1;
  const W = 520, H = 140;
  const py = v => ((maxP - v) / range) * H;
  const px = i => (i / (candles.length - 1)) * W;
  const closePath = candles.map((c,i) => `${i===0?"M":"L"}${px(i).toFixed(1)},${py(c.c).toFixed(1)}`).join(" ");
  const areaPath = closePath + ` L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00FFC6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#00FFC6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#00FFC6" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ca)" />
      {candles.map((c, i) => {
        const x = px(i), top = py(Math.max(c.o,c.c)), bot = py(Math.min(c.o,c.c)), bh = Math.max(bot-top,1.5);
        const col = c.bull ? "#00D68F" : "#FF4D4F";
        return (
          <g key={i}>
            <line x1={x} y1={py(c.h)} x2={x} y2={py(c.l)} stroke={col} strokeWidth="0.7" opacity="0.4" />
            <rect x={x-4.5} y={top} width="9" height={bh} fill={col} opacity="0.9" rx="1.2" />
          </g>
        );
      })}
      <path d={closePath} fill="none" stroke="url(#cl)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

function VolumeBars() {
  const bars = useMemo(() => Array.from({ length: 60 }, () => ({ h: 12+Math.random()*88, bull: Math.random()>0.44 })), []);
  return (
    <div className="flex items-end gap-[1.5px] h-full">
      {bars.map((b,i) => <div key={i} className="flex-1 rounded-[1px]" style={{ height:`${b.h}%`, background: b.bull?"rgba(0,214,143,0.42)":"rgba(255,77,79,0.42)" }} />)}
    </div>
  );
}

function OBRow({ price, size, depth, side }) {
  return (
    <div className="relative grid grid-cols-2 text-[9.5px] font-mono px-2 py-[2.5px] rounded-[2px] overflow-hidden">
      <div className="absolute inset-y-0 right-0" style={{ width:`${depth}%`, background: side==="ask"?"rgba(255,77,79,0.08)":"rgba(0,214,143,0.08)" }} />
      <span className={`tabular-nums z-10 relative font-medium ${side==="ask"?"text-danger":"text-success"}`}>{price}</span>
      <span className="tabular-nums z-10 relative text-white/38 text-right">{size}</span>
    </div>
  );
}

function TerminalMockup({ livePrice }) {
  const base = livePrice ?? 67450;
  const { asks, bids, trades } = useMemo(() => {
    const asks = Array.from({length:10},(_,i) => ({ price:(base+(10-i)*15.4).toFixed(2), size:(0.06+Math.random()*2.5).toFixed(4), depth:14+i*7+Math.random()*12 }));
    const bids = Array.from({length:10},(_,i) => ({ price:(base-i*14.1).toFixed(2), size:(0.08+Math.random()*2.8).toFixed(4), depth:75-i*5.5+Math.random()*8 }));
    const trades = Array.from({length:9},(_,i) => ({ price:(base+(Math.random()*24-12)).toFixed(2), size:(0.001+Math.random()*0.14).toFixed(5), buy:Math.random()>0.46, s:i+1 }));
    return { asks, bids, trades };
  }, []);
  const [activeChart, setActiveChart] = useState("1H");
  const intervals = ["5m","15m","1H","4H","1D"];
  return (
    <div className="relative w-full max-w-[980px] mx-auto mt-16 select-none">
      <div className="absolute -inset-8 pointer-events-none" style={{ background:"radial-gradient(ellipse 65% 55% at 50% 30%,rgba(0,255,198,0.07) 0%,transparent 70%)", filter:"blur(1px)" }} />
      <div className="relative rounded-2xl overflow-hidden terminal-window">
        <div className="flex items-center gap-0 h-[38px] border-b border-white/[0.055]" style={{ background:"rgba(255,255,255,0.018)" }}>
          <div className="flex items-center gap-[6px] pl-4 pr-5 border-r border-white/[0.04] h-full">
            {["#FF5F57","#FFBD2E","#28CA41"].map((c,i) => <div key={i} className="w-[11px] h-[11px] rounded-full flex-shrink-0" style={{ backgroundColor:c, boxShadow:`0 0 5px ${c}55` }} />)}
          </div>
          <div className="flex h-full">
            {["BTC/USDT","ETH/USDT","SOL/USDT"].map((sym,i) => (
              <button key={sym} className={`h-full px-4 text-[10px] font-mono tracking-wide border-r border-white/[0.04] transition-colors ${i===0?"text-accent bg-accent/[0.07] font-semibold":"text-white/22 hover:text-white/45"}`}>{sym}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-5 pr-4 text-[9px] font-mono">
            <span className="text-white/18 tracking-wider">PERP · 20×</span>
            <div className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-success flex-shrink-0" style={{ animation:"pulse-dot 2.2s ease-in-out infinite", boxShadow:"0 0 6px rgba(0,214,143,0.7)" }} />
              <span className="text-success/70 tracking-widest">LIVE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center border-b border-white/[0.04] px-3 h-[32px]" style={{ background:"rgba(0,0,0,0.18)" }}>
          {["Chart","Order Book","Tape","Positions"].map(tab => (
            <button key={tab} className="px-3 h-full text-[9px] font-mono tracking-widest text-white/22 hover:text-white/50 transition-colors">{tab}</button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-[8.5px] font-mono text-white/14">
            <span>UTC 09:41:22</span>
            <span className="text-white/[0.07]">│</span>
            <span className="text-success/50">LATENCY 6ms</span>
          </div>
        </div>
        <div className="grid divide-x divide-white/[0.04]" style={{ gridTemplateColumns:"1fr 170px 140px" }}>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-mono font-bold text-white tabular-nums tracking-tight" style={{ textShadow:"0 0 30px rgba(0,255,198,0.18)" }}>${fmtPrice(base)}</span>
                <span className="flex items-center gap-1 bg-success/[0.1] border border-success/20 rounded px-2 py-0.5"><span className="text-success text-[10px] font-mono font-bold">▲ +2.34%</span></span>
                <span className="text-white/20 text-[9.5px] font-mono">24h</span>
              </div>
              <div className="flex items-center gap-1">
                {intervals.map(iv => (
                  <button key={iv} onClick={() => setActiveChart(iv)}
                    className={`text-[9px] font-mono px-2 py-1 rounded transition-all ${activeChart===iv?"bg-accent/[0.13] text-accent border border-accent/25 shadow-[0_0_10px_rgba(0,255,198,0.1)]":"text-white/22 hover:text-white/50 hover:bg-white/[0.035]"}`}>{iv}</button>
                ))}
              </div>
            </div>
            <div className="h-[140px]"><CandleChart seed={base} /></div>
            <div className="h-[24px]"><VolumeBars /></div>
            <div className="grid grid-cols-5 border-t border-white/[0.04] pt-2.5 gap-px">
              {[["Mark",`$${(base+1.4).toFixed(2)}`],["Index",`$${(base-0.6).toFixed(2)}`],["24h High","$68,942"],["24h Low","$65,210"],["Open Int.","$18.7B"]].map(([l,v]) => (
                <div key={l} className="px-2 first:pl-0">
                  <div className="text-[8px] font-mono text-white/20 tracking-wider mb-0.5 uppercase">{l}</div>
                  <div className="text-[10px] font-mono text-white/62 tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-white/[0.04]">
              <span className="text-[8.5px] font-mono text-white/20 tracking-[0.15em] uppercase">Order Book</span>
              <span className="text-[8px] font-mono text-white/15 bg-white/[0.04] px-1.5 py-0.5 rounded">0.01</span>
            </div>
            <div className="flex justify-between px-2.5 py-1 text-[7.5px] font-mono text-white/14"><span>PRICE (USDT)</span><span>SIZE (BTC)</span></div>
            <div className="px-1 flex flex-col">{asks.map((a,i) => <OBRow key={i} {...a} side="ask" />)}</div>
            <div className="flex items-center justify-center gap-2 py-1.5 my-0.5 border-y border-white/[0.06] mx-2">
              <span className="font-mono font-bold text-[13px] text-white tabular-nums" style={{ textShadow:"0 0 16px rgba(0,255,198,0.2)" }}>{fmtPrice(base)}</span>
              <span className="text-success text-[9px]">▲</span>
            </div>
            <div className="px-1 flex flex-col">{bids.map((b,i) => <OBRow key={i} {...b} side="bid" />)}</div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-white/[0.04]">
              <span className="text-[8.5px] font-mono text-white/20 tracking-[0.15em] uppercase">Recent Trades</span>
            </div>
            <div className="flex justify-between px-2.5 py-1 text-[7.5px] font-mono text-white/14"><span>PRICE</span><span>SIZE</span></div>
            <div className="flex flex-col px-1.5">
              {trades.map((t,i) => (
                <div key={i} className="flex justify-between items-center py-[2.5px]">
                  <span className={`text-[9.5px] font-mono tabular-nums font-medium ${t.buy?"text-success":"text-danger"}`}>{t.price}</span>
                  <span className="text-[8.5px] font-mono tabular-nums text-white/30">{t.size}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-white/[0.04] p-2.5">
              <div className="text-[7.5px] font-mono text-white/15 mb-1.5 tracking-wider uppercase">Taker Buy/Sell</div>
              <div className="h-[5px] rounded-full overflow-hidden flex gap-px" style={{ background:"rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-l-full" style={{ width:"56%", background:"rgba(0,214,143,0.65)" }} />
                <div className="h-full rounded-r-full" style={{ width:"44%", background:"rgba(255,77,79,0.65)" }} />
              </div>
              <div className="flex justify-between mt-1 text-[8px] font-mono"><span className="text-success/55">56% Buy</span><span className="text-danger/55">44% Sell</span></div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.04] px-4 py-2.5 flex flex-wrap items-center gap-6" style={{ background:"rgba(0,0,0,0.22)" }}>
          {[["Funding Rate","+0.0100%","success"],["Next Funding","07:42:18",null],["Basis","+$14.20","success"],["Volume 24h","$2.41B",null],["Trades/sec","1,847",null]].map(([l,v,c]) => (
            <div key={l} className="flex flex-col gap-0.5">
              <span className="text-[7.5px] font-mono text-white/15 tracking-wider uppercase">{l}</span>
              <span className={`text-[10px] font-mono tabular-nums font-medium ${c==="success"?"text-success":c==="danger"?"text-danger":"text-white/50"}`}>{v}</span>
            </div>
          ))}
          <div className="ml-auto flex gap-2">
            <button className="text-[9px] font-mono font-bold px-3 py-1.5 rounded-md transition-all bg-success/[0.12] text-success border border-success/25 hover:bg-success/[0.22]">LONG</button>
            <button className="text-[9px] font-mono font-bold px-3 py-1.5 rounded-md transition-all bg-danger/[0.12] text-danger border border-danger/25 hover:bg-danger/[0.22]">SHORT</button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none rounded-b-2xl" style={{ background:"linear-gradient(to top,#050810 0%,transparent 100%)" }} />
      <div className="absolute -bottom-4 left-8 right-8 h-12 pointer-events-none" style={{ background:"radial-gradient(ellipse 70% 60% at 50% 100%,rgba(0,255,198,0.06) 0%,transparent 70%)", filter:"blur(4px)" }} />
    </div>
  );
}

function FeatureCard({ icon, tag, title, desc, delay = 0 }) {
  return (
    <FadeUp delay={delay} className="h-full">
      <div className="group relative glass-card p-6 rounded-2xl h-full overflow-hidden transition-all duration-300 cursor-default hover:-translate-y-1.5 hover:border-white/[0.12] hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background:"linear-gradient(90deg,transparent,rgba(0,255,198,0.35),transparent)" }} />
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background:"radial-gradient(ellipse,rgba(0,255,198,0.15) 0%,transparent 70%)", filter:"blur(4px)" }} />
        <div className="flex items-start justify-between mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>{icon}</div>
          <span className="text-[8px] font-mono tracking-[0.18em] px-2 py-0.5 rounded border" style={{ color:"rgba(0,255,198,0.5)", borderColor:"rgba(0,255,198,0.14)", background:"rgba(0,255,198,0.05)" }}>{tag}</span>
        </div>
        <h3 className="text-white/90 font-semibold text-[15px] mb-2.5 tracking-tight leading-snug">{title}</h3>
        <p className="text-white/30 text-[13px] leading-[1.7]">{desc}</p>
      </div>
    </FadeUp>
  );
}

function StatBadge({ value, label }) {
  return (
    <FadeUp>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[34px] font-bold tabular-nums tracking-tight" style={{ background:"linear-gradient(135deg,#00FFC6 0%,#00D4FF 50%,#A78BFA 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{value}</span>
        <span className="text-[11px] font-mono text-white/25 tracking-widest uppercase">{label}</span>
      </div>
    </FadeUp>
  );
}

function Nav({ user, navigate, feed }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.045]" style={{ background:"rgba(5,8,16,0.88)", backdropFilter:"blur(24px) saturate(180%)" }}>
      <div className="max-w-page mx-auto flex items-center h-[54px] px-6 md:px-10">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono font-bold text-[16px] text-accent tracking-tight" style={{ textShadow:"0 0 24px rgba(0,255,198,0.45)" }}>GRAVIA</span>
          <span className="hidden sm:inline text-white/[0.07] font-mono text-xs">/ TERMINAL</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 ml-10">
          {[["Product","#"],["Pricing","/pricing"],["Docs","#"]].map(([l,href]) => (
            <Link key={l} to={href} className="text-[12.5px] text-white/32 hover:text-white/72 transition-colors font-medium">{l}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/[0.06]" style={{ background:"rgba(255,255,255,0.025)" }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:feed.connected?"#00D68F":"#FFBD2E", boxShadow:feed.connected?"0 0 6px rgba(0,214,143,0.7)":"0 0 6px rgba(255,189,46,0.5)", animation:"pulse-dot 2.2s ease-in-out infinite" }} />
            <span style={{ color:feed.connected?"rgba(0,214,143,0.8)":"rgba(255,189,46,0.8)" }}>{feed.connected?"live":feed.simulated?"sim":"connecting"}</span>
          </div>
          {user ? (
            <button onClick={() => navigate("/dashboard")} className="btn-primary text-[12.5px] px-4 py-[7px]">Dashboard →</button>
          ) : (
            <>
              <button onClick={() => navigate("/auth")} className="text-[12.5px] text-white/35 hover:text-white/70 transition-colors font-medium hidden sm:block">Sign in</button>
              <button onClick={() => navigate("/auth?tab=signup")} className="btn-primary text-[12.5px] px-4 py-[7px]">Get started</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const feed = useBinanceFeed();
  const [email, setEmail] = useState("");
  const [wlState, setWl] = useState("idle");
  const btc = feed.get("BTCUSDT");

  async function handleWaitlist(e) {
    e.preventDefault(); setWl("loading");
    try {
      const r = await fetch(`${API}/api/waitlist`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) });
      setWl(r.ok ? "done" : "error");
    } catch { setWl("error"); }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background:"#050810" }}>
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background:"radial-gradient(ellipse 95% 50% at 50% -8%,#091A28 0%,transparent 58%)" }} />
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background:"radial-gradient(ellipse 55% 40% at 85% 90%,rgba(99,102,241,0.04) 0%,transparent 60%)" }} />
      <div className="relative z-10">
        <ProgressBar />
        <Ticker feed={feed} />
        <Nav user={user} navigate={navigate} feed={feed} />

        <section className="relative max-w-page mx-auto px-6 md:px-10 pt-[120px] pb-8 text-center">
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[760px] h-[420px] pointer-events-none" style={{ background:"radial-gradient(ellipse,rgba(0,255,198,0.065) 0%,transparent 65%)", animation:"glow-pulse 3s ease-in-out infinite" }} />
          <FadeUp>
            <div className="inline-flex items-center gap-2.5 mb-10 font-mono text-[10.5px] rounded-full px-4 py-1.5 border border-white/[0.07] hover:border-white/[0.14] transition-colors cursor-default" style={{ background:"rgba(255,255,255,0.032)", backdropFilter:"blur(10px)", color:"rgba(255,255,255,0.42)" }}>
              <span className="w-[7px] h-[7px] rounded-full bg-success flex-shrink-0" style={{ boxShadow:"0 0 8px rgba(0,214,143,0.75)", animation:"pulse-dot 2.2s ease-in-out infinite" }} />
              {feed.connected?"Streaming live market data":feed.simulated?"Simulated market feed active":"Connecting to market feed…"}
              <span className="text-white/15">·</span>
              <span className="text-white/28">v2.0</span>
            </div>
          </FadeUp>
          <FadeUp delay={70}>
            <h1 className="text-[58px] md:text-[72px] font-bold leading-[1.02] tracking-[-0.025em] text-white mb-6">
              The terminal for<br />
              <span className="gradient-text" style={{ filter:"drop-shadow(0 0 48px rgba(0,255,198,0.22))" }}>serious traders</span>
            </h1>
          </FadeUp>
          <FadeUp delay={140}>
            <p className="text-white/34 text-[17px] md:text-[19px] max-w-[520px] mx-auto mb-10 leading-[1.65] font-light tracking-[-0.01em]">
              Real-time Binance WebSocket data. Pro-grade terminal UI.<br className="hidden md:block" />
              Stripe billing and Supabase auth — ready to ship.
            </p>
          </FadeUp>
          <FadeUp delay={200}>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
              <button onClick={() => navigate("/auth?tab=signup")} className="btn-primary text-[13.5px] font-bold px-8 py-3.5">Start 14-day free trial →</button>
              <button onClick={() => navigate("/pricing")} className="btn-ghost text-[13.5px] font-medium px-8 py-3.5">View pricing</button>
            </div>
            <p className="text-[11px] font-mono text-white/18 tracking-wide">No credit card required · Cancel anytime</p>
          </FadeUp>
          <FadeUp delay={280}><TerminalMockup livePrice={btc?.price} /></FadeUp>
        </section>

        <FadeUp>
          <section className="max-w-page mx-auto px-6 md:px-10 py-16 border-t border-white/[0.04]">
            <p className="text-center text-[9.5px] font-mono text-white/14 tracking-[0.28em] uppercase mb-8">Trusted by pro traders at</p>
            <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
              {["Citadel Securities","Jump Trading","DRW Cumberland","Two Sigma","GSR Markets","Wintermute"].map(name => (
                <span key={name} className="text-white/[0.11] font-bold text-[12.5px] tracking-tight hover:text-white/[0.24] transition-colors cursor-default select-none grayscale">{name}</span>
              ))}
            </div>
          </section>
        </FadeUp>

        <section className="max-w-page mx-auto px-6 md:px-10 py-16 border-t border-white/[0.04]">
          <div className="flex flex-wrap items-center justify-center gap-14 md:gap-24">
            <StatBadge value="<10ms" label="feed latency" />
            <StatBadge value="6+" label="live pairs" />
            <StatBadge value="99.9%" label="uptime SLA" />
            <StatBadge value="3-tier" label="billing gates" />
          </div>
        </section>

        <section className="max-w-page mx-auto px-6 md:px-10 py-[120px] border-t border-white/[0.04]">
          <FadeUp>
            <div className="text-center mb-16">
              <h2 className="text-[30px] md:text-[36px] font-bold text-white tracking-[-0.022em] mb-4">Built for institutional performance</h2>
              <p className="text-white/28 text-[14.5px] max-w-[460px] mx-auto leading-relaxed">Every layer engineered for speed, reliability, and professional-grade UX.</p>
            </div>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard delay={0} icon="⚡" tag="WS STREAM" title="Sub-10ms latency" desc="Direct Binance WebSocket streams with exponential-backoff reconnect, simulated fallback, and real-time tick data across 6+ trading pairs without polling." />
            <FeatureCard delay={90} icon="◈" tag="PRO TERMINAL" title="Institutional UI" desc="Full-featured order book with depth bars, live candlestick charts, trade tape, volume histogram, and funding rate panel — the full Bloomberg experience in a browser." />
            <FeatureCard delay={180} icon="⬡" tag="FULL STACK" title="Production-ready auth & billing" desc="Supabase JWT auth with RLS, Stripe Checkout + Customer Portal, and per-feature paywall gates. Ship your SaaS in hours — not weeks." />
          </div>
        </section>

        <section className="max-w-page mx-auto px-6 md:px-10 py-[120px] border-t border-white/[0.04]">
          <FadeUp>
            <div className="max-w-[440px] mx-auto text-center">
              <div className="inline-block text-[8.5px] font-mono tracking-[0.22em] border rounded-full px-3 py-1 mb-6" style={{ color:"rgba(0,255,198,0.55)", borderColor:"rgba(0,255,198,0.16)", background:"rgba(0,255,198,0.045)" }}>EARLY ACCESS</div>
              <h2 className="text-[26px] font-bold text-white tracking-tight mb-3">Get 3 months free on Pro</h2>
              <p className="text-white/25 text-[13px] font-mono mb-8 leading-relaxed">Join the waitlist — limited spots before public launch.</p>
              {wlState==="done" ? (
                <div className="flex items-center justify-center gap-2 font-mono text-[13px] text-accent" style={{ textShadow:"0 0 12px rgba(0,255,198,0.4)" }}>✓ You're on the list. We'll be in touch.</div>
              ) : (
                <form onSubmit={handleWaitlist} className="flex gap-2">
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@hedgefund.com"
                    className="flex-1 text-[13px] text-white placeholder-white/20 rounded-xl px-4 py-2.5 outline-none border border-white/[0.08] focus:border-accent/35 transition-colors"
                    style={{ background:"rgba(255,255,255,0.03)", backdropFilter:"blur(8px)" }} />
                  <button type="submit" disabled={wlState==="loading"} className="btn-primary text-[12.5px] font-bold px-5 py-2.5 disabled:opacity-40 flex-shrink-0">{wlState==="loading"?"…":"Join"}</button>
                </form>
              )}
              {wlState==="error" && <p className="text-danger text-[11px] font-mono mt-2">Something went wrong — try again.</p>}
            </div>
          </FadeUp>
        </section>

        <footer className="border-t border-white/[0.04]" style={{ background:"rgba(0,0,0,0.22)" }}>
          <div className="max-w-page mx-auto px-6 md:px-10 py-8 flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono font-bold text-[14px] text-accent" style={{ textShadow:"0 0 18px rgba(0,255,198,0.35)" }}>GRAVIA</span>
            <div className="flex items-center gap-7 text-[11.5px] text-white/22">
              <Link to="/pricing" className="hover:text-white/52 transition-colors">Pricing</Link>
              <a href="#" className="hover:text-white/52 transition-colors">Privacy</a>
              <a href="#" className="hover:text-white/52 transition-colors">Terms</a>
              <a href="#" className="hover:text-white/52 transition-colors">Docs</a>
            </div>
            <span className="text-[11px] font-mono text-white/14">© 2026 Gravia. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
