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
        brand2:   "#6366f1",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "hero-radial": "radial-gradient(ellipse 80% 60% at 50% -5%, #0D2030 0%, #050810 55%)",
      },
      animation: {
        "ticker":    "ticker-scroll 40s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow":      "glow-pulse 2s ease-in-out infinite",
        "fade-up":   "fadeUp 0.6s ease-out forwards",
      },
      keyframes: {
        "ticker-scroll": {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.4" },
          "50%":      { opacity: "0.8" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "accent":    "0 0 30px rgba(0,255,198,0.25)",
        "accent-lg": "0 0 60px rgba(0,255,198,0.15)",
        "glass":     "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      backdropBlur: {
        xs: "4px",
      },
    },
  },
  plugins: [],
};
