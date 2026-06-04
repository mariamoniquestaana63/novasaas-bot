import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const RANK = { free: 0, starter: 1, pro: 2, elite: 3 };

export default function PaywallGate({ children, requiredPlan = "starter", label, blur = 8 }) {
  const { user, plan, isActive } = useAuth();
  const navigate = useNavigate();
  const hasAccess = isActive && (RANK[plan] ?? 0) >= (RANK[requiredPlan] ?? 1);

  if (hasAccess) return children;

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div style={{ filter: `blur(${blur}px)`, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/70 backdrop-blur-sm z-10">
        <div className="text-center px-6 py-8 max-w-xs">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="text-white font-bold text-sm mb-2">
            {label ?? `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan required`}
          </h3>
          <p className="text-gray-400 text-xs mb-5 leading-relaxed">
            Upgrade to unlock this feature. 14-day free trial included.
          </p>
          <button
            onClick={() => navigate(user ? "/pricing" : "/auth")}
            className="bg-brand text-black font-bold text-xs px-5 py-2.5 rounded-lg hover:opacity-90 transition w-full"
          >
            {user ? "Upgrade →" : "Sign up free"}
          </button>
        </div>
      </div>
    </div>
  );
}
