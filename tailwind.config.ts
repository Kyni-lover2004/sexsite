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
          950: "#030302",
          900: "#070604",
          800: "#0d0b08",
          700: "#17130c",
          600: "#241d12",
          500: "#342916",
        },
        // Champagne gold primary accent
        accent: {
          DEFAULT: "#d6a84f",
          soft: "#f5d58a",
          deep: "#9c6d24",
          muted: "#6f4b19",
        },
        // Rich gold secondary accent
        gold: {
          DEFAULT: "#c9973f",
          soft: "#ffe6a6",
          deep: "#8f5f1a",
          glow: "#fff2bf",
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
          100: "#fff7dd",
          200: "#ecd49c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #9c6d24 0%, #f5d58a 48%, #b8842c 100%)",
        "accent-gradient-v":
          "linear-gradient(180deg, #f5d58a 0%, #b8842c 100%)",
        "accent-gradient-subtle":
          "linear-gradient(135deg, rgba(245,213,138,0.13) 0%, rgba(156,109,36,0.14) 100%)",
        "gold-gradient":
          "linear-gradient(135deg, #8f5f1a 0%, #ffe6a6 46%, #c9973f 100%)",
        "mesh-gradient":
          "linear-gradient(135deg, rgba(255,230,166,0.08) 0%, transparent 34%), linear-gradient(180deg, rgba(201,151,63,0.06) 0%, transparent 42%)",
        "glow-radial":
          "radial-gradient(circle at 50% 0%, rgba(245,213,138,0.12), transparent 62%)",
        "card-shine":
          "linear-gradient(105deg, transparent 34%, rgba(255,242,191,0.04) 45%, rgba(255,255,255,0.09) 50%, rgba(255,230,166,0.04) 56%, transparent 66%)",
      },
      boxShadow: {
        glass: "0 18px 55px rgba(0,0,0,0.58)",
        "glow-accent": "0 0 34px rgba(245,213,138,0.2)",
        "glow-accent-lg": "0 0 60px rgba(245,213,138,0.18), 0 0 120px rgba(201,151,63,0.1)",
        "glow-gold": "0 0 34px rgba(255,230,166,0.24)",
        "glow-gold-lg": "0 0 70px rgba(255,230,166,0.2)",
        "glow-emerald": "0 0 24px rgba(52,211,153,0.35)",
        "neon-accent": "0 0 10px rgba(245,213,138,0.42), 0 0 28px rgba(201,151,63,0.2)",
        "neon-gold": "0 0 10px rgba(255,230,166,0.45), 0 0 26px rgba(201,151,63,0.22)",
        "inner-glow": "inset 0 1px 1px rgba(255,242,191,0.08)",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(245,213,138,0.12)" },
          "50%": { boxShadow: "0 0 45px rgba(245,213,138,0.24), 0 0 90px rgba(201,151,63,0.1)" },
        },
        "text-glow": {
          "0%, 100%": { textShadow: "0 0 10px rgba(245,213,138,0.22)" },
          "50%": { textShadow: "0 0 22px rgba(245,213,138,0.42), 0 0 44px rgba(201,151,63,0.16)" },
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
