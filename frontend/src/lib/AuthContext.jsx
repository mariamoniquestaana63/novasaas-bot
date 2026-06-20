import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const API = import.meta.env.VITE_API_URL ?? "/api";
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null);
  const [session, setSession]       = useState(null);
  const [subscription, setSub]      = useState(null);
  const [loading, setLoading]       = useState(true);

  async function fetchSub(token) {
    try {
      const r = await fetch(`${API}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setSub(await r.json());
    } catch { setSub({ subscribed: false, plan: "free" }); }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null);
      if (session?.access_token) fetchSub(session.access_token);
      setLoading(false);
    });
    const { data: { subscription: s } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session); setUser(session?.user ?? null);
      if (session?.access_token) fetchSub(session.access_token);
      else setSub(null);
    });
    return () => s.unsubscribe();
  }, []);

  const plan     = subscription?.plan ?? "free";
  const isActive = ["active", "trialing"].includes(subscription?.status);
  const isPro    = isActive && ["pro", "elite"].includes(plan);
  const isElite  = isActive && plan === "elite";

  const signUp  = (email, password, name) =>
    supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      .then(({ data, error }) => { if (error) throw error; return data; });

  const signIn  = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })
      .then(({ data, error }) => { if (error) throw error; return data; });

  const signOut = () => supabase.auth.signOut().then(() => setSub(null));

  return (
    <Ctx.Provider value={{ user, session, subscription, loading, plan, isActive, isPro, isElite, signUp, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
