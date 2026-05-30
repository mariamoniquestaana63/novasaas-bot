import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const PLAN_RANK = { free: 0, starter: 1, pro: 2, elite: 3 };

/**
 * Wraps children with a blurred overlay if the user's plan is below `requiredPlan`.
 *
 * Props:
 *   requiredPlan  "pro" | "enterprise"   (default "pro")
 *   label         string override for the gate title
 *   blur          number px (default 8)
 */
export default function PaywallGate({ children, requiredPlan = "starter", label, blur = 8 }) {
  const { user, plan, isActive } = useAuth();
  const navigate = useNavigate();

  const userRank     = PLAN_RANK[plan] ?? 0;
  const requiredRank = PLAN_RANK[requiredPlan] ?? 1;
  const hasAccess    = isActive && userRank >= requiredRank;

  if (hasAccess) return children;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Blurred content */}
      <div style={{ filter: `blur(${blur}px)`, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/70 backdrop-blur-sm z-10">
        <div className="text-center px-6 py-8 max-w-xs">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="text-white font-bold text-lg mb-2">
            {label ?? `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Plan Required`}
          </h3>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Unlock full terminal access, real-time WebSocket feeds, and advanced analytics.
          </p>
          <button
            onClick={() => navigate(user ? "/pricing" : "/auth")}
            className="bg-brand text-black font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition w-full"
          >
            {user ? "Upgrade Plan" : "Sign up free"}
          </button>
          {user && (
            <p className="text-gray-500 text-xs mt-3">14-day free trial · Cancel anytime</p>
          )}
        </div>
      </div>
    </div>
  );
}
