"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Crown,
  Eye,
  Headphones,
  Images,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  User,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { NewGuestsBadge } from "./NewGuestsBadge";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the cramped mobile tab bar. */
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/profile", label: "Анкета", shortLabel: "Профиль", icon: User },
  { href: "/chat", label: "Сообщения", shortLabel: "Чаты", icon: MessagesSquare },
  { href: "/guests", label: "Гости", shortLabel: "Гости", icon: Eye },
  { href: "/people", label: "Поиск", shortLabel: "Люди", icon: Users },
  { href: "/", label: "Обсуждения", shortLabel: "Форум", icon: MessageSquare },
];

const PERSONAL_NAV: NavItem[] = [
  { href: "/friends", label: "Мои друзья", icon: UserRoundCheck },
  { href: "/my-photos", label: "Мои фото", icon: Images },
];

const PREMIUM: NavItem = { href: "/premium", label: "Премиум", icon: Crown };

const SUPPORT: NavItem = {
  href: "/support",
  label: "Поддержка",
  icon: Headphones,
};

export function AppShell({
  children,
  noPadding = false,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="relative min-h-svh overflow-x-hidden">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gold/10 bg-base-950/98 px-4 py-6 shadow-[18px_0_60px_rgba(0,0,0,0.34)] md:flex">
        <Link href="/" className="group mb-9 flex items-center gap-3 px-2">
          <motion.span
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="shrink-0"
          >
            <BrandLogo size={40} priority />
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

        <nav className="flex flex-1 flex-col">
          {NAV.map((item, index) => {
            const active = isActive(item.href);
            return (
              <div key={item.href}>
                <Link
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
                      active &&
                        "text-gold-soft drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.42)]"
                    )}
                  />
                  {item.label}
                  {item.href === "/guests" ? (
                    <NewGuestsBadge />
                  ) : (
                    active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-soft shadow-neon-gold" />
                    )
                  )}
                </Link>
                {index < NAV.length - 1 && (
                  <div className="mx-2 h-px bg-gradient-to-r from-transparent via-black/70 to-transparent dark:via-black" />
                )}
              </div>
            );
          })}
          <div className="my-2 h-px bg-gradient-to-r from-transparent via-black/70 to-transparent dark:via-black" />
          {PERSONAL_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-gold/10 text-warm-100"
                    : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href={PREMIUM.href}
          className={cn(
            "mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(PREMIUM.href)
              ? "bg-gold/10 text-warm-100"
              : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
          )}
        >
          <PREMIUM.icon className="h-5 w-5" />
          {PREMIUM.label}
        </Link>
        <Link
          href={SUPPORT.href}
          className={cn(
            "mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(SUPPORT.href)
              ? "bg-gold/10 text-warm-100"
              : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
          )}
        >
          <SUPPORT.icon className="h-5 w-5" />
          {SUPPORT.label}
        </Link>
        <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-black/70 to-transparent dark:via-black" />
        <div className="flex items-center justify-between px-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft/35">
            v0.1 · E2EE ready
          </p>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ---------- Main content (pads around mobile chrome) ---------- */}
      {/*
        Mobile chrome:
          top bar  = 3.5rem + safe-area-top
          tab bar  = 4.25rem + safe-area-bottom
        Content must clear both so the tab bar never covers text.
      */}
      <main
        className={cn(
          "relative z-10 flex min-w-0 flex-col md:pl-64",
          noPadding
            ? "h-svh min-h-0 max-md:pt-[calc(3.5rem+env(safe-area-inset-top))] max-md:pb-[calc(4.25rem+env(safe-area-inset-bottom))]"
            : "max-md:pt-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] max-md:pb-[calc(4.25rem+env(safe-area-inset-bottom)+1.25rem)]"
        )}
      >
        {noPadding ? (
          <div className="flex w-full min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          <div className="mx-auto w-full max-w-4xl px-4 pb-2 md:px-8 md:py-10">
            {children}
          </div>
        )}
      </main>

      {/* ---------- Mobile top bar (left: logo + menu) ---------- */}
      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-gold/10 bg-base-950/92 backdrop-blur-xl md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="shrink-0"
              aria-label="Desire Privé — на главную"
            >
              <BrandLogo size={36} priority />
            </Link>
            <span className="truncate font-display text-sm font-bold tracking-tight text-gradient">
              Desire Privé
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell compact />
            <ThemeToggle className="!h-10 !w-10" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 bg-base-900/70 text-warm-100"
              aria-label="Открыть меню"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Mobile drawer (from the RIGHT — under the hamburger) ---------- */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="flex h-full w-[min(84vw,20rem)] flex-col border-l border-gold/15 bg-base-950 p-4 shadow-[-18px_0_50px_rgba(0,0,0,0.45)]"
            style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandLogo size={36} />
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-warm-100">
                    Desire Privé
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft/50">
                    private menu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:bg-base-800"
                aria-label="Закрыть меню"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {[...PERSONAL_NAV, PREMIUM, SUPPORT].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-gold/10 text-warm-100"
                      : "text-slate-300 hover:bg-gold/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-gold/10 pt-3">
              <LogoutButton wide />
            </div>
          </motion.div>
        </div>
      )}

      {/* ---------- Mobile bottom tab bar (5 items, short labels) ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/12 bg-base-950/94 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5 items-stretch px-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-w-0 touch-manipulation flex-col items-center justify-center gap-1 px-0.5 pt-1 text-[10px] font-medium leading-none transition-colors",
                  active ? "text-gold-soft" : "text-slate-500"
                )}
              >
                {active && (
                  <span className="absolute top-0 h-[2px] w-8 rounded-full bg-gold-gradient shadow-[0_0_10px_rgb(var(--gold-glow)/0.45)]" />
                )}
                <span className="relative">
                  <item.icon
                    className={cn(
                      "h-[1.35rem] w-[1.35rem] shrink-0",
                      active &&
                        "drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.42)]"
                    )}
                  />
                  {item.href === "/guests" && (
                    <NewGuestsBadge compact />
                  )}
                </span>
                <span className="block max-w-full truncate text-center">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LogoutButton({ wide = false }: { wide?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title="Выйти из аккаунта"
      className={cn(
        "text-slate-500 transition-all duration-200",
        "hover:bg-red-500/10 hover:text-red-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
        loading && "pointer-events-none opacity-50",
        wide
          ? "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium"
          : "grid h-8 w-8 place-items-center rounded-lg"
      )}
    >
      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500/30 border-t-slate-500" />
      ) : (
        <>
          <LogOut size={wide ? 18 : 15} />
          {wide && <span>Выйти</span>}
        </>
      )}
    </button>
  );
}
