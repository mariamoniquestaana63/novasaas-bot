import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "/api";

const ADMIN_EMAIL = "mariamoniquestaana63@gmail.com";

function StatCard({ label, value, sub, color = "accent" }) {
  const colors = {
    accent:  { val: "#00FFC6", glow: "rgba(0,255,198,0.15)" },
    blue:    { val: "#00D4FF", glow: "rgba(0,212,255,0.15)" },
    purple:  { val: "#A78BFA", glow: "rgba(167,139,250,0.15)" },
    success: { val: "#00D68F", glow: "rgba(0,214,143,0.15)" },
  };
  const c = colors[color];
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-2"
      style={{ boxShadow: `0 0 32px ${c.glow}` }}>
      <span className="text-[10px] font-mono text-white/25 tracking-[0.18em] uppercase">{label}</span>
      <span className="text-[36px] font-bold tabular-nums tracking-tight"
        style={{ color: c.val, textShadow: `0 0 24px ${c.glow}` }}>
        {value ?? "—"}
      </span>
      {sub && <span className="text-[11px] font-mono text-white/25">{sub}</span>}
    </div>
  );
}

function Table({ columns, rows, emptyMsg = "No data" }) {
  if (!rows?.length) return (
    <div className="text-center py-12 text-white/20 text-sm font-mono">{emptyMsg}</div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map(c => (
              <th key={c.key} className="text-left py-2.5 px-3 text-[9px] font-mono text-white/20 tracking-[0.16em] uppercase font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.035] hover:bg-white/[0.025] transition-colors">
              {columns.map(c => (
                <td key={c.key} className="py-2.5 px-3">
                  {c.render ? c.render(row[c.key], row) : (
                    <span className="text-white/55 font-mono tabular-nums">{row[c.key] ?? "—"}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanBadge({ plan }) {
  const colors = {
    elite:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
    pro:     "bg-accent/10 text-accent border-accent/25",
    starter: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    free:    "bg-white/5 text-white/30 border-white/10",
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${colors[plan] ?? colors.free}`}>
      {plan ?? "free"}
    </span>
  );
}

function StatusDot({ status }) {
  const map = {
    active:   { color: "#00D68F", label: "active" },
    trialing: { color: "#FFBD2E", label: "trial" },
    canceled: { color: "#FF4D4F", label: "canceled" },
    past_due: { color: "#FF4D4F", label: "past due" },
  };
  const s = map[status] ?? { color: "#8892A4", label: status ?? "—" };
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px]" style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export default function AdminPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.email !== ADMIN_EMAIL) { navigate("/dashboard", { replace: true }); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const tabs = ["overview", "subscribers", "waitlist"];

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen font-sans" style={{ background: "#050810" }}>
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

      <div className="relative z-10">
        <header className="border-b border-white/[0.06] sticky top-0 z-50"
          style={{ background: "rgba(5,8,16,0.92)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-6xl mx-auto flex items-center h-[52px] px-6 gap-6">
            <span className="font-mono font-bold text-[15px] text-accent"
              style={{ textShadow: "0 0 20px rgba(0,255,198,0.4)" }}>
              BAYESIAN
            </span>
            <span className="text-white/[0.07] font-mono text-xs">/ ADMIN</span>
            <div className="flex items-center gap-1 ml-4">
              {tabs.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider transition-all ${
                    tab === t
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-white/25 hover:text-white/50"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-[10px] font-mono text-white/20">{user.email}</span>
              <button onClick={() => navigate("/dashboard")}
                className="text-[11px] font-mono text-white/30 hover:text-white/60 transition border border-white/[0.08] px-3 py-1.5 rounded">
                ← Dashboard
              </button>
              <button onClick={fetchData}
                className="text-[11px] font-mono text-accent/60 hover:text-accent transition border border-accent/20 px-3 py-1.5 rounded">
                ↻ Refresh
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="text-white/20 text-xs font-mono">Loading admin data…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/25 rounded-xl p-4 text-danger text-sm font-mono mb-6">
              {error}
            </div>
          )}

          {!loading && data && (
            <>
              {tab === "overview" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-white/60 text-[11px] font-mono tracking-[0.2em] uppercase mb-4">Key metrics</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard label="Total users"  value={data.stats.total_users}  color="accent" />
                      <StatCard label="Active subs"  value={data.stats.active_subs}  color="success" sub="paid + trialing" />
                      <StatCard label="Waitlist"     value={data.stats.waitlist_count} color="blue" />
                      <StatCard label="MRR (est.)"   value={data.stats.mrr ? `$${data.stats.mrr}` : "$0"} color="purple" sub="based on active plans" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-white/60 text-[11px] font-mono tracking-[0.2em] uppercase mb-4">Plan breakdown</h2>
                    <div className="grid grid-cols-3 gap-4">
                      {["starter","pro","elite"].map(plan => (
                        <div key={plan} className="glass-card rounded-xl p-4 flex items-center justify-between">
                          <PlanBadge plan={plan} />
                          <span className="text-white font-bold text-xl tabular-nums">
                            {data.stats.plans?.[plan] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-white/60 text-[11px] font-mono tracking-[0.2em] uppercase mb-4">Recent waitlist signups</h2>
                    <div className="glass-card rounded-2xl overflow-hidden">
                      <Table
                        columns={[
                          { key: "email",      label: "Email",     render: v => <span className="text-white/70 font-mono">{v}</span> },
                          { key: "created_at", label: "Signed up", render: v => <span className="text-white/30 font-mono">{v ? new Date(v).toLocaleString() : "—"}</span> },
                        ]}
                        rows={data.waitlist?.slice(0, 5)}
                        emptyMsg="No waitlist signups yet"
                      />
                    </div>
                  </div>
                </div>
              )}

              {tab === "subscribers" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/60 text-[11px] font-mono tracking-[0.2em] uppercase">
                      All subscribers ({data.subscribers?.length ?? 0})
                    </h2>
                  </div>
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <Table
                      columns={[
                        { key: "email",               label: "Email",    render: v => <span className="text-white/75 font-mono">{v}</span> },
                        { key: "plan",                label: "Plan",     render: v => <PlanBadge plan={v} /> },
                        { key: "status",              label: "Status",   render: v => <StatusDot status={v} /> },
                        { key: "current_period_end",  label: "Renews",   render: v => <span className="text-white/30 font-mono">{v ? new Date(v).toLocaleDateString() : "—"}</span> },
                        { key: "cancel_at_period_end",label: "Canceling",render: v => v ? <span className="text-danger text-[10px] font-mono">yes</span> : <span className="text-white/20 text-[10px] font-mono">no</span> },
                      ]}
                      rows={data.subscribers}
                      emptyMsg="No subscribers yet"
                    />
                  </div>
                </div>
              )}

              {tab === "waitlist" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/60 text-[11px] font-mono tracking-[0.2em] uppercase">
                      Waitlist ({data.waitlist?.length ?? 0})
                    </h2>
                  </div>
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <Table
                      columns={[
                        { key: "email",      label: "Email",     render: v => <span className="text-white/75 font-mono">{v}</span> },
                        { key: "created_at", label: "Signed up", render: v => <span className="text-white/30 font-mono">{v ? new Date(v).toLocaleString() : "—"}</span> },
                      ]}
                      rows={data.waitlist}
                      emptyMsg="No waitlist signups yet"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
