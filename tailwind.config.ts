import type { Config } from "tailwindcss";

/**
 * Tokens only. Every value resolves to a CSS custom property defined in
 * `src/index.css`, so the palette and the type scale have exactly one home and
 * a shader, a canvas, and a DOM node can all read the same number.
 *
 * Colours are named for materials — lapis, verdigris, orpiment, madder, brass,
 * gold, vellum — because Castalia is a manuscript and an instrument cabinet
 * rather than a screen effect, and naming a token `glow` invites reaching for
 * it whenever something should stand out. Gold in particular is scarce on
 * purpose: it marks what is genuinely settled, and it stops meaning that the
 * moment it is used for emphasis.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "hsl(var(--void) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",

        vellum: "hsl(var(--vellum) / <alpha-value>)",
        bright: "hsl(var(--bright) / <alpha-value>)",
        dim: "hsl(var(--dim) / <alpha-value>)",
        faint: "hsl(var(--faint) / <alpha-value>)",

        gold: "hsl(var(--gold) / <alpha-value>)",
        brass: "hsl(var(--brass) / <alpha-value>)",
        glass: "hsl(var(--glass) / <alpha-value>)",

        lapis: "hsl(var(--lapis) / <alpha-value>)",
        verdigris: "hsl(var(--verdigris) / <alpha-value>)",
        orpiment: "hsl(var(--orpiment) / <alpha-value>)",
        madder: "hsl(var(--madder) / <alpha-value>)",

        // Aliases retained so components still compiling against the old names
        // keep building through the art pass. New work uses a material name.
        glow: "hsl(var(--glow) / <alpha-value>)",
        "glow-2": "hsl(var(--glow-2) / <alpha-value>)",
        "glow-3": "hsl(var(--glow-3) / <alpha-value>)",
        resonance: "hsl(var(--resonance) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Cormorant Variable'", "Cormorant", "Georgia", "serif"],
        ui: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        caption: ["var(--text-caption)", { lineHeight: "1.45" }],
        body: ["var(--text-body)", { lineHeight: "1.55" }],
        lead: ["var(--text-lead)", { lineHeight: "1.62" }],
        title: ["var(--text-title)", { lineHeight: "1.2" }],
        display: ["var(--text-display)", { lineHeight: "1.05" }],
      },
      letterSpacing: {
        engraved: "var(--tracking-engraved)",
      },
      transitionTimingFunction: {
        enter: "var(--ease-enter)",
        exit: "var(--ease-exit)",
      },
      keyframes: {
        // Entry is a settle, not a slide: things in Castalia arrive by coming
        // into focus rather than by flying in from off-screen.
        settle: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.994)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // A held breath, shared with the scene's global pulse so DOM surfaces
        // and the world are visibly alive at the same rate.
        breathe: {
          "0%, 100%": { opacity: "0.72" },
          "50%": { opacity: "1" },
        },
        // Available, not urgent. Used only to invite Attunement.
        invite: {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--gold) / 0)" },
          "50%": { boxShadow: "0 0 26px 1px hsl(var(--gold) / 0.22)" },
        },
      },
      animation: {
        settle: "settle 0.62s var(--ease-enter) both",
        breathe: "breathe 6.2s ease-in-out infinite",
        invite: "invite 4.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
