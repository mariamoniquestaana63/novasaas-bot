import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "/api";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 29,
    desc: "Live data for individual traders.",
    features: [
      { t: "4 pairs real-time", ok: true },
      { t: "Terminal dashboard", ok: true },
      { t: "14-day free trial", ok: true },
      { t: "Advanced order book", ok: false },
      { t: "API access", ok: false },
    ],
  },
  {
    id: "pro", name: "Pro", price: 79, featured: true,
    desc: "Full terminal for active traders.",
    features: [
      { t: "All 6 pairs real-time", ok: true },
      { t: "Advanced order book", ok: true },
      { t: "Priority support", ok: true },
      { t: "14-day free trial", ok: true },
      { t: "API access", ok: false },
    ],
  },
  {
    id: "elite", name: "Elite", price: 199,
    desc: "Unlimited data, API, SLA.",
    features: [
      { t: "Unlimited pairs", ok: true },
      { t: "Full terminal + API", ok: true },
      { t: "Custom feeds", ok: true },
      { t: "Dedicated support", ok: true },
      { t: "14-day free trial", ok: true },
    ],
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);
  const { user, session, plan: currentPlan, isActive } = useAuth();
  const navigate = useNavigate();

  async function checkout(planId) {
    if (!user) { navigate("/auth?tab=signup"); return; }
    setLoading(planId);
    try {
      const r = await fetch(`${API}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
    } finally { setLoading(null); }
  }

  async function openPortal() {
    const r = await fetch(`${API}/api/portal`, {
      method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  }

  return (
    <div className="min-h-screen bg-surface font-mono px-6 md:px-12 py-12">
      <div className="flex items-center mb-12">
        <Link to="/" className="text-[#00ff88] font-bold text-lg">GRAVIA</Link>
        <div className="ml-auto">
          {user ? (
            <button onClick={() => navigate("/dashboard")} className="bg-[#00ff88] text-black font-bold px-4 py-1.5 rounded text-xs">Dashboard</button>
          ) : (
            <button onClick={() => navigate("/auth")} className="text-gray-400 hover:text-white transition text-xs">Sign in</button>
          )}
        </div>
      </div>
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-3">Simple pricing</h1>
        <p className="text-gray-400 text-sm">14-day free trial on all paid plans. Cancel anytime.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {PLANS.map(p => {
          const isCurrent = isActive && currentPlan === p.id;
          return (
            <div key={p.id} className={`relative bg-surface2 border rounded-xl p-6 flex flex-col transition hover:-translate-y-1 ${p.featured ? "border-[#00ff88]" : "border-white/10"}`}>
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00ff88] text-black text-[10px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
              )}
              <div className="mb-4">
                <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">{p.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">${p.price}</span>
                  <span className="text-gray-500 text-sm mb-1.5">/mo</span>
                </div>
                <p className="text-gray-500 text-xs mt-2">{p.desc}</p>
              </div>
              <ul className="flex flex-col gap-2 mb-6 flex-1">
                {p.features.map(f => (
                  <li key={f.t} className={`flex items-center gap-2.5 text-xs ${f.ok ? "text-gray-200" : "text-gray-600"}`}>
                    <span className={f.ok ? "text-[#00ff88]" : "text-gray-600"}>{f.ok ? "✓" : "✕"}</span>
                    {f.t}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button onClick={openPortal} className="border border-[#00ff88]/40 text-[#00ff88] text-xs font-bold py-2.5 rounded-lg hover:bg-[#00ff88]/5 transition">Manage</button>
              ) : (
                <button onClick={() => checkout(p.id)} disabled={loading === p.id}
                  className={`text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-60 ${p.featured ? "bg-[#00ff88] text-black hover:opacity-90" : "border border-white/10 text-gray-300 hover:border-white/50"}`}>
                  {loading === p.id ? "Redirecting…" : "Start free trial"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
