import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-driven surface scale
        base: {
          950: "rgb(var(--base-950) / <alpha-value>)",
          900: "rgb(var(--base-900) / <alpha-value>)",
          800: "rgb(var(--base-800) / <alpha-value>)",
          700: "rgb(var(--base-700) / <alpha-value>)",
          600: "rgb(var(--base-600) / <alpha-value>)",
          500: "rgb(var(--base-500) / <alpha-value>)",
        },
        // Muted luxury metal accent
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          deep: "rgb(var(--accent-deep) / <alpha-value>)",
          muted: "rgb(var(--accent-muted) / <alpha-value>)",
        },
        // Champagne / platinum gold secondary accent
        gold: {
          DEFAULT: "rgb(var(--gold) / <alpha-value>)",
          soft: "rgb(var(--gold-soft) / <alpha-value>)",
          deep: "rgb(var(--gold-deep) / <alpha-value>)",
          glow: "rgb(var(--gold-glow) / <alpha-value>)",
        },
        // Ruby is reserved for rare highlights and errors
        ruby: {
          glow: "#b4533f",
        },
        // Keep emerald for online status
        emerald: {
          glow: "#34d399",
        },
        // Warm neutral for some text
        warm: {
          100: "rgb(var(--warm-100) / <alpha-value>)",
          200: "rgb(var(--warm-200) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, rgb(var(--accent-deep)) 0%, rgb(var(--gold-soft)) 48%, rgb(var(--accent)) 100%)",
        "accent-gradient-v":
          "linear-gradient(180deg, rgb(var(--gold-soft)) 0%, rgb(var(--accent)) 100%)",
        "accent-gradient-subtle":
          "linear-gradient(135deg, rgb(var(--gold-soft) / 0.13) 0%, rgb(var(--accent-deep) / 0.14) 100%)",
        "gold-gradient":
          "linear-gradient(135deg, rgb(var(--gold-deep)) 0%, rgb(var(--gold-soft)) 48%, rgb(var(--gold)) 100%)",
        "mesh-gradient":
          "linear-gradient(135deg, rgb(var(--gold-soft) / 0.08) 0%, transparent 34%), linear-gradient(180deg, rgb(var(--gold) / 0.06) 0%, transparent 42%)",
        "glow-radial":
          "radial-gradient(circle at 50% 0%, rgb(var(--gold-soft) / 0.12), transparent 62%)",
        "card-shine":
          "linear-gradient(105deg, transparent 34%, rgb(var(--gold-glow) / 0.04) 45%, rgba(255,255,255,0.09) 50%, rgb(var(--gold-soft) / 0.04) 56%, transparent 66%)",
      },
      boxShadow: {
        glass: "0 18px 55px rgb(0 0 0 / 0.18)",
        "glow-accent": "0 0 34px rgb(var(--gold-soft) / 0.16)",
        "glow-accent-lg": "0 0 60px rgb(var(--gold-soft) / 0.14), 0 0 120px rgb(var(--gold) / 0.08)",
        "glow-gold": "0 0 34px rgb(var(--gold-glow) / 0.2)",
        "glow-gold-lg": "0 0 70px rgb(var(--gold-glow) / 0.16)",
        "glow-emerald": "0 0 24px rgba(52,211,153,0.35)",
        "neon-accent": "0 0 10px rgb(var(--gold-soft) / 0.34), 0 0 28px rgb(var(--gold) / 0.16)",
        "neon-gold": "0 0 10px rgb(var(--gold-glow) / 0.35), 0 0 26px rgb(var(--gold) / 0.18)",
        "inner-glow": "inset 0 1px 1px rgb(var(--gold-glow) / 0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%": { transform: "translateY(-8px) rotate(1deg)" },
          "66%": { transform: "translateY(4px) rotate(-1deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "border-rotate": {
          "0%": { "--angle": "0deg" } as any,
          "100%": { "--angle": "360deg" } as any,
        },
        "shimmer-sweep": {
          "0%": { transform: "translateX(-100%) skewX(-15deg)" },
          "100%": { transform: "translateX(200%) skewX(-15deg)" },
        },
        "particle-drift": {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(-100vh) translateX(20px)", opacity: "0" },
        },
        "glow-breathe": {
          "0%, 100%": { boxShadow: "0 0 20px rgb(var(--gold-soft) / 0.12)" },
          "50%": { boxShadow: "0 0 45px rgb(var(--gold-soft) / 0.22), 0 0 90px rgb(var(--gold) / 0.1)" },
        },
        "text-glow": {
          "0%, 100%": { textShadow: "0 0 10px rgb(var(--gold-soft) / 0.2)" },
          "50%": { textShadow: "0 0 22px rgb(var(--gold-soft) / 0.34), 0 0 44px rgb(var(--gold) / 0.14)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 10s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
        "border-rotate": "border-rotate 4s linear infinite",
        "shimmer-sweep": "shimmer-sweep 2s ease-in-out infinite",
        "glow-breathe": "glow-breathe 4s ease-in-out infinite",
        "text-glow": "text-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
