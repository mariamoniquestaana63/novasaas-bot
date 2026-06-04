/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface:  "#0a0a0f",
        surface2: "#111118",
        surface3: "#1a1a28",
        brand:    "#00ff88",
        brand2:   "#6366f1",
      },
      fontFamily: { mono: ["'JetBrains Mono'", "monospace"] },
    },
  },
  plugins: [],
};
