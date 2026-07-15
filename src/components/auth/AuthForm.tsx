"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Crown,
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

  const paramError = searchParams.get("error");
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const options =
      mode === "register"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    const { error: authError } = options;
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "register") {
      setMode("login");
      setError("Проверьте почту для подтверждения регистрации");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleOAuth(provider: string) {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
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
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.2,
              }}
              className="mb-8 grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold-gradient text-white shadow-glow-gold animate-glow-breathe"
            >
              <Crown size={30} />
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
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.15,
                }}
                className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-gold/30 bg-gold-gradient text-white shadow-glow-gold animate-glow-breathe lg:hidden"
              >
                <Crown size={26} />
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

            {/* Divider */}
            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              <span className="text-xs text-slate-600">или</span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            </div>

            {/* OAuth */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("google")}
                disabled={loading}
              >
                <GoogleLogo />
                Войти через Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("telegram")}
                disabled={loading}
              >
                <TelegramLogo />
                Войти через Telegram
              </Button>
            </div>

            {/* Mode switch */}
            <p className="mt-8 text-center text-sm text-slate-500">
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
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#0088cc">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
