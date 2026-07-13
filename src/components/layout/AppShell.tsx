"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, Users, MessagesSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/", label: "Обсуждения", icon: MessageSquare },
  { href: "/people", label: "Люди", icon: Users },
  { href: "/chat", label: "Чаты", icon: MessagesSquare },
  { href: "/profile", label: "Профиль", icon: User },
];

/**
 * Responsive app shell — premium dark edition.
 * - Desktop: fixed left sidebar with glow accents.
 * - Mobile: bottom navigation bar with glow indicators.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="relative min-h-svh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.04] bg-base-900/70 px-4 py-6 backdrop-blur-2xl md:flex">
        {/* Logo */}
        <Link href="/" className="group mb-8 flex items-center gap-2.5 px-2">
          <motion.span
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient font-display text-lg font-bold text-white shadow-glow-accent"
          >
            N
          </motion.span>
          <span className="font-display text-xl font-bold tracking-tight text-gradient">
            Nebula
          </span>
        </Link>

        {/* Gradient divider */}
        <div className="mx-3 mb-4 h-px bg-gradient-to-r from-accent/30 via-gold/20 to-transparent" />

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
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/[0.03] hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-xl bg-accent-gradient-subtle shadow-[0_0_20px_rgba(225,29,120,0.08)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active && "text-accent-soft drop-shadow-[0_0_6px_rgba(225,29,120,0.4)]"
                  )}
                />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shadow-neon-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Decorative orb */}
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-accent/[0.04] blur-3xl" />

        <div className="mx-3 mt-4 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <p className="px-3 text-[10px] text-slate-600">v0.1 · E2EE ready</p>
      </aside>

      {/* Main content */}
      <main className="relative z-10 pb-24 md:pl-64 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.04] bg-base-900/85 backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-all duration-200",
                  active ? "text-accent-soft" : "text-slate-500"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobilenav-active"
                    className="absolute top-0 h-[2px] w-10 rounded-full bg-accent-gradient shadow-[0_0_8px_rgba(225,29,120,0.5)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active && "drop-shadow-[0_0_6px_rgba(225,29,120,0.5)]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
