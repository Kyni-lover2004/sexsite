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
        // Deep obsidian background scale
        base: {
          950: "#030304",
          900: "#09090b",
          800: "#0f0f14",
          700: "#18181f",
          600: "#22222d",
          500: "#2e2e3a",
        },
        // Hot pink / magenta primary accent
        accent: {
          DEFAULT: "#e11d78",
          soft: "#f472b6",
          deep: "#be185d",
          muted: "#9d174d",
        },
        // Gold / amber secondary accent
        gold: {
          DEFAULT: "#f59e0b",
          soft: "#fbbf24",
          deep: "#d97706",
          glow: "#fde68a",
        },
        // Rose supplementary
        rose: {
          glow: "#fb7185",
        },
        // Keep emerald for online status
        emerald: {
          glow: "#34d399",
        },
        // Warm neutral for some text
        warm: {
          100: "#fef3c7",
          200: "#fde68a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #e11d78 0%, #f59e0b 100%)",
        "accent-gradient-v":
          "linear-gradient(180deg, #e11d78 0%, #f59e0b 100%)",
        "accent-gradient-subtle":
          "linear-gradient(135deg, rgba(225,29,120,0.15) 0%, rgba(245,158,11,0.15) 100%)",
        "gold-gradient":
          "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)",
        "mesh-gradient":
          "radial-gradient(ellipse at 20% 0%, rgba(225,29,120,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(245,158,11,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(225,29,120,0.06) 0%, transparent 50%)",
        "glow-radial":
          "radial-gradient(circle at 50% 0%, rgba(225,29,120,0.14), transparent 60%)",
        "card-shine":
          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.5)",
        "glow-accent": "0 0 30px rgba(225,29,120,0.3)",
        "glow-accent-lg": "0 0 60px rgba(225,29,120,0.25), 0 0 120px rgba(225,29,120,0.1)",
        "glow-gold": "0 0 30px rgba(245,158,11,0.3)",
        "glow-gold-lg": "0 0 60px rgba(245,158,11,0.2)",
        "glow-emerald": "0 0 24px rgba(52,211,153,0.35)",
        "neon-accent": "0 0 8px rgba(225,29,120,0.6), 0 0 24px rgba(225,29,120,0.3)",
        "neon-gold": "0 0 8px rgba(245,158,11,0.6), 0 0 24px rgba(245,158,11,0.3)",
        "inner-glow": "inset 0 1px 1px rgba(255,255,255,0.06)",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(225,29,120,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(225,29,120,0.3), 0 0 80px rgba(225,29,120,0.1)" },
        },
        "text-glow": {
          "0%, 100%": { textShadow: "0 0 10px rgba(225,29,120,0.3)" },
          "50%": { textShadow: "0 0 20px rgba(225,29,120,0.5), 0 0 40px rgba(225,29,120,0.2)" },
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
