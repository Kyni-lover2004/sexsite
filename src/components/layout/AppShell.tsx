"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Crown, Headphones, MessageSquare, MessagesSquare, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/", label: "Обсуждения", icon: MessageSquare },
  { href: "/people", label: "Поиск", icon: Users },
  { href: "/chat", label: "Чаты", icon: MessagesSquare },
  { href: "/support", label: "Поддержка", icon: Headphones },
  { href: "/profile", label: "Профиль", icon: User },
  { href: "/premium", label: "Премиум", icon: Crown },
];

export function AppShell({
  children,
  noPadding = false,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 border-b border-gold/10 bg-[linear-gradient(180deg,rgb(var(--gold-glow)/0.12),transparent)]" />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gold/10 bg-base-950/98 px-4 py-6 shadow-[18px_0_60px_rgba(0,0,0,0.34)] md:flex">
        <Link href="/" className="group mb-9 flex items-center gap-3 px-2">
          <motion.span
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold-gradient text-white shadow-glow-gold"
          >
            <Crown size={19} />
          </motion.span>
          <span>
            <span className="block font-display text-xl font-bold tracking-tight text-gradient">
              Desire Privé
            </span>
            <span className="block text-[10px] uppercase tracking-[0.24em] text-gold-soft/55">
              private club
            </span>
          </span>
        </Link>

        <div className="mx-3 mb-4 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-warm-100"
                    : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-xl border border-gold/20 bg-accent-gradient-subtle shadow-[0_0_24px_rgb(var(--gold-glow)/0.08)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active && "text-gold-soft drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.42)]"
                  )}
                />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-soft shadow-neon-gold" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mt-4 mb-3 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
        <div className="flex items-center justify-between px-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft/35">v0.1 · E2EE ready</p>
          <ThemeToggle />
        </div>
      </aside>

      <main className={cn(
        "relative z-10 flex flex-col md:pl-64 min-w-0",
        noPadding ? "h-svh pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0"
      )}>
        {noPadding ? (
          <div className="w-full flex-1 flex flex-col min-h-0">
            {children}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        )}
      </main>

      <div className="fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-30 md:hidden">
        <ThemeToggle />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-base-950/98 px-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.32)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 items-stretch">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-h-[3.75rem] min-w-0 touch-manipulation flex-col items-center justify-center gap-1 overflow-hidden px-0.5 pt-2 text-[10px] font-medium leading-none transition-all duration-200",
                  active ? "text-gold-soft" : "text-slate-500"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobilenav-active"
                    className="absolute top-0 h-[2px] w-10 rounded-full bg-gold-gradient shadow-[0_0_10px_rgb(var(--gold-glow)/0.45)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    active && "drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.42)]"
                  )}
                />
                <span className="block max-w-full truncate text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
