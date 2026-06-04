import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function AuthPage() {
  const [params]   = useSearchParams();
  const [tab, setTab]         = useState(params.get("tab") === "signup" ? "signup" : "login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user]);

  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (tab === "signup") { await signUp(email, password, name); setDone(true); }
      else { await signIn(email, password); navigate("/dashboard", { replace: true }); }
    } catch (err) { setError(err.message ?? "Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 font-mono">
      <Link to="/" className="text-[#00ff88] font-bold text-lg mb-10">BAYESIAN</Link>
      <div className="w-full max-w-sm bg-surface2 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex border-b border-white/5">
          {["login", "signup"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); setDone(false); }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest transition ${tab === t ? "text-[#00ff88] border-b-2 border-[#00ff88]" : "text-gray-500 hover:text-gray-300"}`}>
              {t === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-white font-bold text-sm mb-2">Check your inbox</p>
              <p className="text-gray-400 text-xs leading-relaxed">Confirmation link sent to <span className="text-[#00ff88]">{email}</span>.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              {tab === "signup" && (
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                    className="w-full bg-surface3 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00ff88]/40 transition" />
                </div>
              )}
              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full bg-surface3 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00ff88]/40 transition" />
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1.5 block">Password</label>
                <input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder={tab === "signup" ? "8+ characters" : "Your password"} required
                  className="w-full bg-surface3 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00ff88]/40 transition" />
              </div>
              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="bg-[#00ff88] text-black font-bold py-2.5 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-60 mt-1">
                {loading ? "…" : tab === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
