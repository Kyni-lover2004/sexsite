"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { safeRedirectPath } from "@/lib/utils";

/* ---------- password strength ---------- */
function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Слабый", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Средний", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Хороший", color: "bg-yellow-400" };
  return { score, label: "Отличный", color: "bg-emerald-400" };
}

/* ---------- decorative features for the left panel ---------- */
const DECO_FEATURES = [
  { icon: MessageSquare, label: "Обсуждения и форум" },
  { icon: Users, label: "Поиск людей" },
  { icon: Shield, label: "Сквозное шифрование" },
];

/* ---------- main component ---------- */
export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirm18, setConfirm18] = useState(false);

  const paramError = searchParams.get("error");
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register") {
      if (!confirm18) {
        setError("Подтвердите, что вам есть 18 лет.");
        return;
      }
      if (!acceptTerms) {
        setError("Примите условия и политику конфиденциальности.");
        return;
      }
    }
    setLoading(true);

    const next = safeRedirectPath(searchParams.get("next"), "/");

    if (mode === "register") {
      // No email verification: sign up and enter immediately (Confirm email OFF in Supabase).
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setLoading(false);
        setError(signUpError.message);
        return;
      }

      // If project still has confirm-email ON, session may be null — try password login.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setLoading(false);
          setError(
            "Аккаунт создан, но вход заблокирован подтверждением почты. " +
              "В Supabase: Authentication → Providers → Email → выключите Confirm email."
          );
          return;
        }
      }

      void import("@/lib/analytics").then(({ trackEvent }) =>
        trackEvent("signup_completed")
      );
      setLoading(false);
      router.push(next);
      router.refresh();
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-base-950">
      {/* ---- Decorative background ---- */}
      <div className="pointer-events-none fixed inset-0 hero-mesh" />
      <div className="orb orb-gold orb-animate-1 h-80 w-80 -top-24 -left-24 opacity-50" />
      <div className="orb orb-accent orb-animate-2 h-96 w-96 -bottom-32 -right-32 opacity-35" />

      {/* ---- LEFT: Decorative panel (desktop only) ---- */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="auth-deco-panel absolute inset-0" />
        <div className="particle-field absolute inset-0" />
        <div className="relative z-10 max-w-md">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Logo */}
            <motion.span
              initial={{ scale: 0, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.2,
              }}
              className="mb-8 inline-block animate-glow-breathe"
            >
              <BrandLogo size={64} className="rounded-2xl" priority />
            </motion.span>

            <h1 className="font-display text-4xl font-bold leading-tight text-gradient xl:text-5xl">
              Desire Privé
            </h1>
            <p className="mt-1 text-sm uppercase tracking-[0.24em] text-gold-soft/50">
              private club
            </p>
            <p className="mt-6 max-w-sm text-base leading-7 text-slate-400">
              Современная приватная платформа для общения, знакомств и обсуждений
              в защищённой атмосфере.
            </p>

            {/* Feature pills */}
            <div className="mt-10 space-y-3">
              {DECO_FEATURES.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 rounded-xl border border-gold/10 bg-base-800/40 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/10">
                    <f.icon size={17} className="text-gold-soft" />
                  </div>
                  <span className="text-sm font-medium text-warm-100">
                    {f.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ---- RIGHT: Auth form ---- */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <GlassCard premium className="p-8 sm:p-10">
            {/* Header */}
            <div className="mb-8 text-center">
              {/* Mobile-only logo */}
              <motion.span
                initial={{ scale: 0, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.15,
                }}
                className="mx-auto mb-4 inline-block animate-glow-breathe lg:hidden"
              >
                <BrandLogo size={56} className="rounded-2xl" priority />
              </motion.span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <h1 className="font-display text-2xl font-bold text-gradient">
                    {mode === "login" ? "Добро пожаловать" : "Создать аккаунт"}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">
                    {mode === "login"
                      ? "Войдите в свой аккаунт"
                      : "Присоединяйтесь к сообществу"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Error display */}
            <AnimatePresence>
              {(error || paramError) && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400"
                >
                  {error ||
                    (paramError === "auth_failed"
                      ? "Ошибка входа. Попробуйте снова."
                      : paramError)}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Пароль
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength indicator (register only) */}
                <AnimatePresence>
                  {mode === "register" && password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pt-1.5"
                    >
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={`strength-bar flex-1 ${
                              i < strength.score
                                ? strength.color
                                : "bg-base-700/60"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Сила пароля:{" "}
                        <span className="text-slate-400">
                          {strength.label}
                        </span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {mode === "register" && (
                <div className="space-y-2.5 rounded-xl border border-gold/10 bg-base-900/40 px-3 py-3">
                  <label className="flex items-start gap-2.5 text-xs leading-snug text-slate-400">
                    <input
                      type="checkbox"
                      checked={confirm18}
                      onChange={(e) => setConfirm18(e.target.checked)}
                      className="mt-0.5 rounded border-gold/30 accent-amber-600"
                    />
                    <span>
                      Мне есть <strong className="text-slate-300">18 лет</strong>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 text-xs leading-snug text-slate-400">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded border-gold/30 accent-amber-600"
                    />
                    <span>
                      Принимаю{" "}
                      <Link
                        href="/legal/terms"
                        className="text-gold-soft underline"
                        target="_blank"
                      >
                        условия
                      </Link>
                      ,{" "}
                      <Link
                        href="/legal/privacy"
                        className="text-gold-soft underline"
                        target="_blank"
                      >
                        конфиденциальность
                      </Link>{" "}
                      и{" "}
                      <Link
                        href="/legal/rules"
                        className="text-gold-soft underline"
                        target="_blank"
                      >
                        правила 18+
                      </Link>
                    </span>
                  </label>
                </div>
              )}

              {/* Submit */}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    {mode === "login" ? (
                      <LogIn size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {mode === "login" ? "Войти" : "Зарегистрироваться"}
                  </>
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-[10px] text-slate-600">
              <Link href="/legal" className="hover:text-gold-soft">
                Правовые документы
              </Link>
            </p>

            {/* Mode switch */}
            <p className="mt-6 text-center text-sm text-slate-500">
              {mode === "login" ? (
                <>
                  Нет аккаунта?{" "}
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    className="inline-flex items-center gap-1 font-medium text-gold-soft transition-colors hover:text-gold hover:underline"
                  >
                    Зарегистрироваться
                    <ArrowRight size={13} />
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{" "}
                  <button
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="inline-flex items-center gap-1 font-medium text-gold-soft transition-colors hover:text-gold hover:underline"
                  >
                    Войти
                    <ArrowRight size={13} />
                  </button>
                </>
              )}
            </p>

            {/* Back to home */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs text-slate-600 transition-colors hover:text-slate-400"
              >
                ← На главную
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- OAuth logos ---------- */


