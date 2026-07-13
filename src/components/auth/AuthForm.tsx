"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const paramError = searchParams.get("error");

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
    await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: `${location.origin}/auth/callback` } });
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-base-950 px-4 overflow-hidden">
      {/* Floating orbs background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-accent/[0.07] blur-[100px] animate-float" />
        <div className="absolute bottom-1/3 right-1/4 h-56 w-56 rounded-full bg-gold/[0.05] blur-[80px] animate-float-slow" />
        <div className="absolute top-1/2 right-1/3 h-40 w-40 rounded-full bg-accent/[0.04] blur-[60px] animate-float" style={{ animationDelay: "-3s" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <GlassCard premium className="p-8">
          <div className="mb-6 text-center">
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent-gradient font-display text-2xl font-bold text-white shadow-glow-accent animate-glow-breathe"
            >
              N
            </motion.span>
            <h1 className="font-display text-xl font-bold text-gradient">
              {mode === "login" ? "Вход" : "Регистрация"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login"
                ? "Добро пожаловать обратно"
                : "Создайте аккаунт"}
            </p>
          </div>

          {(error || paramError) && (
            <p className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error || (paramError === "auth_failed" ? "Ошибка входа. Попробуйте снова." : paramError)}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Пароль</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              <LogIn size={16} />
              {loading ? "…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            <span className="text-xs text-slate-600">или</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("google")}
              disabled={loading}
            >
              <GoogleLogo />
              Google
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("telegram")}
              disabled={loading}
            >
              <TelegramLogo />
              Telegram
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            {mode === "login" ? (
              <>
                Нет аккаунта?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="font-medium text-accent-soft hover:underline"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="font-medium text-accent-soft hover:underline"
                >
                  Войти
                </button>
              </>
            )}
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}

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
