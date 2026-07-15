"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Crown, Eye, Headphones, Images, LogOut, Menu, MessageSquare, MessagesSquare, User, UserRoundCheck, Users, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/profile", label: "Анкета", icon: User },
  { href: "/chat", label: "Сообщения", icon: MessagesSquare },
  { href: "/guests", label: "Гости", icon: Eye },
  { href: "/people", label: "Поиск", icon: Users },
  { href: "/", label: "Обсуждения", icon: MessageSquare },
];

const PERSONAL_NAV: NavItem[] = [
  { href: "/friends", label: "Мои друзья", icon: UserRoundCheck },
  { href: "/my-videos", label: "Мои видео", icon: Video },
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
    <div className="relative min-h-svh overflow-hidden">
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
                      active && "text-gold-soft drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.42)]"
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-soft shadow-neon-gold" />
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
                  active ? "bg-gold/10 text-warm-100" : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
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
            isActive(PREMIUM.href) ? "bg-gold/10 text-warm-100" : "text-slate-500 hover:bg-gold/[0.05] hover:text-warm-100"
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
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft/35">v0.1 · E2EE ready</p>
          <div className="flex items-center gap-2">
            <LogoutButton />
            <ThemeToggle />
          </div>
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
          <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-20 md:px-8 md:py-10">
            {children}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="fixed left-4 top-[calc(1rem+env(safe-area-inset-top))] z-30 grid h-11 w-11 place-items-center rounded-xl border border-gold/20 bg-base-950/95 text-warm-100 backdrop-blur md:hidden"
        aria-label="Открыть личные разделы"
      >
        <Menu size={19} />
      </button>
      <div className="fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-30 md:hidden">
        <ThemeToggle />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="h-full w-[min(82vw,20rem)] border-r border-gold/15 bg-base-950 p-4 pt-[calc(1rem+env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-warm-100">Личные разделы</p>
              <button onClick={() => setMobileMenuOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl text-slate-400" aria-label="Закрыть меню"><X size={20}/></button>
            </div>
            <nav className="space-y-1">
              {[...PERSONAL_NAV, PREMIUM, SUPPORT].map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-300 hover:bg-gold/10 hover:text-white"><item.icon className="h-5 w-5"/>{item.label}</Link>)}
            </nav>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-base-950/98 px-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.32)] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 items-stretch">
          {[...NAV, PREMIUM].map((item) => {
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

function LogoutButton() {
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
        "grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-all duration-200",
        "hover:bg-red-500/10 hover:text-red-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
        loading && "pointer-events-none opacity-50"
      )}
    >
      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500/30 border-t-slate-500" />
      ) : (
        <LogOut size={15} />
      )}
    </button>
  );
}
