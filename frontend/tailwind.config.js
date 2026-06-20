/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface:  "#050810",
        surface2: "#080C14",
        surface3: "#0D1420",
        accent:   "#00FFC6",
        accent2:  "#00D4FF",
        danger:   "#FF4D4F",
        success:  "#00D68F",
        muted:    "#8892A4",
        brand2:   "#A78BFA",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "ticker":      "ticker-scroll 48s linear infinite",
        "pulse-dot":   "pulse-dot 2.2s ease-in-out infinite",
        "glow":        "glow-pulse 2.5s ease-in-out infinite",
        "fade-up":     "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
        "shimmer":     "shimmer 1.8s ease-in-out infinite",
        "border-glow": "borderGlow 3s ease-in-out infinite",
      },
      keyframes: {
        "ticker-scroll": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0.4" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.55" },
          "50%":     { opacity: "0.95" },
        },
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(28px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        borderGlow: {
          "0%,100%": { borderColor: "rgba(0,255,198,0.08)" },
          "50%":     { borderColor: "rgba(0,255,198,0.24)" },
        },
      },
      boxShadow: {
        "accent-sm": "0 0 20px rgba(0,255,198,0.2)",
        "accent-md": "0 0 40px rgba(0,255,198,0.32)",
        "accent-lg": "0 0 80px rgba(0,255,198,0.18)",
        "glass":     "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        "terminal":  "0 48px 120px rgba(0,0,0,0.85)",
      },
      backdropBlur: { xs: "4px" },
    },
  },
  plugins: [],
};
