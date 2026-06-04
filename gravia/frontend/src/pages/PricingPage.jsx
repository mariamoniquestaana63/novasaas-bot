import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "/api";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    desc: "Live market data for individual traders.",
    features: [
      { text: "4 pairs real-time", included: true },
      { text: "Live Binance WebSocket", included: true },
      { text: "Terminal dashboard", included: true },
      { text: "14-day free trial", included: true },
      { text: "Advanced order book", included: false },
      { text: "API access", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    desc: "Full terminal access for active traders.",
    featured: true,
    features: [
      { text: "All 6 pairs real-time", included: true },
      { text: "Live Binance WebSocket", included: true },
      { text: "Advanced order book", included: true },
      { text: "14-day free trial", included: true },
      { text: "Priority support", included: true },
      { text: "API access", included: false },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 199,
    desc: "Unlimited data, API access, and SLA.",
    features: [
      { text: "Unlimited pairs", included: true },
      { text: "Custom WebSocket feeds", included: true },
      { text: "Full terminal + API", included: true },
      { text: "14-day free trial", included: true },
      { text: "Dedicated support", included: true },
      { text: "Custom SLA", included: true },
    ],
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);
  const { user, session, plan: currentPlan, isActive } = useAuth();
  const navigate = useNavigate();

  async function checkout(planId) {
    if (!user) { navigate("/auth?tab=signup"); return; }
    if (planId === "free") return;
    setLoading(planId);
    try {
      const res = await fetch(`${API}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setLoading(null); }
  }

  async function openPortal() {
    if (!user || !session) return;
    const res = await fetch(`${API}/api/portal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="min-h-screen bg-surface font-mono px-6 md:px-12 py-12">
      {/* Nav */}
      <div className="flex items-center mb-12">
        <Link to="/" className="text-brand font-bold text-lg glow-brand">GRAVIA</Link>
        <div className="ml-auto flex gap-4 text-sm">
          {user ? (
            <>
              <button onClick={openPortal} className="text-gray-400 hover:text-white transition text-xs">Manage billing</button>
              <button onClick={() => navigate("/dashboard")} className="bg-brand text-black font-bold px-4 py-1.5 rounded text-xs">Dashboard</button>
            </>
          ) : (
            <button onClick={() => navigate("/auth")} className="text-gray-400 hover:text-white transition text-xs">Sign in</button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, honest pricing</h1>
        <p className="text-gray-400 text-sm mb-8">14-day free trial on Pro and Enterprise. No card required.</p>

        <p className="text-gray-500 text-xs">All prices in USD · billed monthly · cancel anytime</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {PLANS.map((p) => {
          const isCurrent = isActive && currentPlan === p.id;

          return (
            <div
              key={p.id}
              className={`relative bg-surface2 border rounded-xl p-6 flex flex-col transition ${
                p.featured ? "border-brand glow-box" : "border-white/8"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-black text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">{p.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">${p.price}</span>
                  <span className="text-gray-500 text-sm mb-1.5">/mo</span>
                </div>
                <p className="text-gray-500 text-xs mt-2">{p.desc}</p>
              </div>

              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f.text} className={`flex items-center gap-2.5 text-xs ${f.included ? "text-gray-200" : "text-gray-600"}`}>
                    <span className={f.included ? "text-brand" : "text-gray-600"}>
                      {f.included ? "✓" : "✕"}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button onClick={openPortal} className="border border-brand/40 text-brand text-xs font-bold py-2.5 rounded-lg hover:bg-brand/5 transition">
                  Manage subscription
                </button>
              ) : p.id === "free" ? (
                <button onClick={() => navigate(user ? "/dashboard" : "/auth")} className="border border-white/10 text-gray-400 text-xs font-bold py-2.5 rounded-lg hover:border-white/20 hover:text-white transition">
                  {user ? "Go to dashboard" : "Get started free"}
                </button>
              ) : (
                <button
                  onClick={() => checkout(p.id)}
                  disabled={loading === p.id}
                  className={`text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-60 ${
                    p.featured
                      ? "bg-brand text-black hover:opacity-90"
                      : "border border-white/10 text-gray-300 hover:border-brand/40 hover:text-white"
                  }`}
                >
                  {loading === p.id ? "Redirecting…" : "Start 14-day trial"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="max-w-xl mx-auto mt-16 text-xs text-gray-500 text-center space-y-2">
        <p>All plans include email support. Enterprise adds a dedicated Slack channel.</p>
        <p>Cancel anytime from your billing portal — no questions asked.</p>
        <p>Annual plans are billed upfront. Monthly plans renew each month.</p>
      </div>
    </div>
  );
}
