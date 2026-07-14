"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Crown, MessageSquare, MessagesSquare, User, Users } from "lucide-react";
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
 * Responsive app shell for the premium black-gold interface.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 border-b border-gold/10 bg-[linear-gradient(180deg,rgba(255,230,166,0.08),transparent)]" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gold/10 bg-base-950/82 px-4 py-6 shadow-[18px_0_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:flex">
        {/* Logo */}
        <Link href="/" className="group mb-9 flex items-center gap-3 px-2">
          <motion.span
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold-gradient text-base-950 shadow-glow-gold"
          >
            <Crown size={19} />
          </motion.span>
          <span>
            <span className="block font-display text-xl font-bold tracking-tight text-gradient">
              Nebula
            </span>
            <span className="block text-[10px] uppercase tracking-[0.24em] text-gold-soft/55">
              private club
            </span>
          </span>
        </Link>

        {/* Gradient divider */}
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
                    className="absolute inset-0 -z-10 rounded-xl border border-gold/20 bg-accent-gradient-subtle shadow-[0_0_24px_rgba(245,213,138,0.08)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active && "text-gold-soft drop-shadow-[0_0_8px_rgba(245,213,138,0.42)]"
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

        <div className="mx-3 mt-4 mb-2 h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
        <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-gold-soft/35">v0.1 · E2EE ready</p>
      </aside>

      {/* Main content */}
      <main className="relative z-10 pb-24 md:pl-64 md:pb-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/10 bg-base-950/90 shadow-[0_-18px_45px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-all duration-200",
                  active ? "text-gold-soft" : "text-slate-500"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobilenav-active"
                    className="absolute top-0 h-[2px] w-10 rounded-full bg-gold-gradient shadow-[0_0_10px_rgba(245,213,138,0.45)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active && "drop-shadow-[0_0_8px_rgba(245,213,138,0.42)]"
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
