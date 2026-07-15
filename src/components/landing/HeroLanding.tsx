"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Crown,
  LogIn,
  MessageSquare,
  MessagesSquare,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

/* ---------- typewriter ---------- */
const WORDS = ["обсуждения", "знакомства", "общение", "приватность"];

function useTypewriter(words: string[], speed = 90, pause = 2000) {
  const [text, setText] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];

    const timeout = setTimeout(
      () => {
        if (!deleting) {
          setText(word.slice(0, text.length + 1));
          if (text.length + 1 === word.length) {
            setTimeout(() => setDeleting(true), pause);
          }
        } else {
          setText(word.slice(0, text.length - 1));
          if (text.length === 0) {
            setDeleting(false);
            setWordIdx((i) => (i + 1) % words.length);
          }
        }
      },
      deleting ? speed / 2 : speed
    );

    return () => clearTimeout(timeout);
  }, [text, deleting, wordIdx, words, speed, pause]);

  return text;
}

/* ---------- count-up ---------- */
function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setVal(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return <span ref={ref}>{val.toLocaleString("ru-RU")}</span>;
}

/* ---------- feature data ---------- */
const FEATURES = [
  {
    icon: MessageSquare,
    title: "Обсуждения",
    desc: "Форум с тёплыми дискуссиями в приватной атмосфере. Меньше шума, больше смысла.",
    gradient: "from-amber-500/20 to-orange-600/20",
  },
  {
    icon: Users,
    title: "Знакомства",
    desc: "Находите интересных людей, фильтруйте по интересам, смотрите кто сейчас онлайн.",
    gradient: "from-rose-500/20 to-pink-600/20",
  },
  {
    icon: Shield,
    title: "Защищённый чат",
    desc: "Мессенджер со сквозным шифрованием. Ваши разговоры остаются только вашими.",
    gradient: "from-emerald-500/20 to-teal-600/20",
  },
];

/* ---------- main component ---------- */
export function HeroLanding() {
  const typed = useTypewriter(WORDS);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-base-950">
      {/* ---- Background ---- */}
      <div className="hero-mesh pointer-events-none fixed inset-0" />
      <div className="particle-field pointer-events-none fixed inset-0" />

      {/* Floating orbs */}
      <div className="orb orb-gold orb-animate-1 h-72 w-72 -top-20 -left-20 opacity-60" />
      <div className="orb orb-accent orb-animate-2 h-96 w-96 -bottom-32 -right-32 opacity-40" />
      <div className="orb orb-gold orb-animate-2 h-48 w-48 top-1/3 right-1/4 opacity-30" />

      {/* ---- Content ---- */}
      <div className="relative z-10 flex flex-col">
        {/* Nav bar */}
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold-gradient text-white shadow-glow-gold"
            >
              <Crown size={19} />
            </motion.span>
            <span className="font-display text-lg font-bold tracking-tight text-gradient">
              Desire Privé
            </span>
          </div>
          <Link href="/login">
            <Button size="sm" variant="outline">
              <LogIn size={15} />
              Войти
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 text-center sm:pt-24 md:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/[0.07] px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-gold-soft/80">
              <Sparkles size={13} className="animate-pulse-glow" />
              закрытый клуб
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-7xl"
          >
            <span className="text-gradient glow-text">Пространство для</span>
            <br />
            <span className="relative inline-block min-w-[200px] text-left sm:min-w-[280px] md:min-w-[400px]">
              <span className="text-warm-100">{typed}</span>
              <span className="cursor-blink ml-0.5 text-gold-soft">|</span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg"
          >
            Современная социальная платформа: форум с обсуждениями, поиск
            интересных людей и мессенджер со сквозным шифрованием.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4"
          >
            <Link href="/login?mode=register">
              <Button size="lg" className="min-w-[200px]">
                <Zap size={18} />
                Присоединиться
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="min-w-[200px]">
                <LogIn size={18} />
                Войти
              </Button>
            </Link>
          </motion.div>
        </section>

        {/* Features */}
        <section className="mx-auto mt-28 w-full max-w-5xl px-6 sm:mt-36">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <h2 className="font-display text-2xl font-bold text-gradient sm:text-3xl">
              Всё, что нужно
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Три главных инструмента в одном месте
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="tilt-card"
              >
                <div className="tilt-card-inner">
                  <GlassCard
                    interactive
                    className="group relative overflow-hidden p-6"
                  >
                    {/* Subtle gradient glow in corner */}
                    <div
                      className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${f.gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                    />
                    <div className="relative">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-gold/20 bg-gold/10 shadow-inner-glow">
                        <f.icon size={22} className="text-gold-soft" />
                      </div>
                      <h3 className="mb-2 font-display text-lg font-semibold text-warm-100">
                        {f.title}
                      </h3>
                      <p className="text-sm leading-6 text-slate-400">
                        {f.desc}
                      </p>
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto mt-28 w-full max-w-4xl px-6 sm:mt-36">
          <div className="rounded-2xl border border-gold/15 bg-base-900/50 p-8 shadow-glass backdrop-blur-xl sm:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-soft/40 to-transparent" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <StatBlock label="Участников" value={500} suffix="+" />
              <StatBlock label="Обсуждений" value={1200} suffix="+" />
              <StatBlock label="Сообщений" value={15000} suffix="+" />
              <StatBlock label="Онлайн" value={42} />
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto mt-28 mb-20 w-full max-w-3xl px-6 text-center sm:mt-36">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7 }}
          >
            <GlassCard premium className="p-10 sm:p-14">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold-gradient text-white shadow-glow-gold animate-glow-breathe">
                <Crown size={28} />
              </div>
              <h2 className="font-display text-2xl font-bold text-gradient sm:text-3xl">
                Готовы присоединиться?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                Создайте аккаунт за 30 секунд и станьте частью закрытого
                сообщества с приватной атмосферой.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                <Link href="/login?mode=register">
                  <Button size="lg" className="min-w-[200px]">
                    <Sparkles size={18} />
                    Создать аккаунт
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="min-w-[200px]">
                    Уже есть аккаунт
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gold/10 py-8 text-center text-xs text-slate-600">
          <p>
            © {new Date().getFullYear()} Desire Privé · Все права защищены
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ---------- stat block ---------- */
function StatBlock({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-warm-100 sm:text-4xl">
        <CountUp target={value} />
        <span className="text-gold-soft">{suffix}</span>
      </div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
    </div>
  );
}
