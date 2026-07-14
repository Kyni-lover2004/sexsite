"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("desire-prive-theme") as Theme | null;
    const preferred: Theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";

    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("desire-prive-theme", next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20",
        "bg-base-900/70 text-gold-soft shadow-inner-glow backdrop-blur-xl",
        "transition-all duration-300 hover:border-gold/40 hover:bg-gold/10 hover:text-warm-100",
        className
      )}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить темную тему"}
      title={theme === "dark" ? "Светлая тема" : "Темная тема"}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
