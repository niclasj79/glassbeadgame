import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "hsl(var(--void) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        bright: "hsl(var(--bright) / <alpha-value>)",
        dim: "hsl(var(--dim) / <alpha-value>)",
        glow: "hsl(var(--glow) / <alpha-value>)",
        "glow-2": "hsl(var(--glow-2) / <alpha-value>)",
        "glow-3": "hsl(var(--glow-3) / <alpha-value>)",
        resonance: "hsl(var(--resonance) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Cormorant Variable'", "Cormorant", "Georgia", "serif"],
        ui: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "invite-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(42 92% 60% / 0)" },
          "50%": { boxShadow: "0 0 22px 2px hsl(42 92% 60% / 0.35)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 3s ease-in-out infinite",
        "invite-pulse": "invite-pulse 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
