import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const API = import.meta.env.VITE_API_URL ?? "/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [session, setSession]         = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading]         = useState(true);

  // Fetch subscription from backend
  async function fetchSubscription(token) {
    try {
      const res = await fetch(`${API}/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSubscription(await res.json());
    } catch {
      setSubscription({ subscribed: false, plan: "free" });
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) fetchSubscription(session.access_token);
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) fetchSubscription(session.access_token);
        else setSubscription(null);
      }
    );

    return () => authSub.unsubscribe();
  }, []);

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSubscription(null);
  }

  // Plan access helpers
  const plan = subscription?.plan ?? "free";
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const isPro = isActive && (plan === "pro" || plan === "elite");
  const isElite = isActive && plan === "elite";

  return (
    <AuthContext.Provider value={{
      user, session, subscription, loading,
      plan, isActive, isPro, isElite,
      signUp, signIn, signOut,
      refreshSubscription: () => session?.access_token ? fetchSubscription(session.access_token) : null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
