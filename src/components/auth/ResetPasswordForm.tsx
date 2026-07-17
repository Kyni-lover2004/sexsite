"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { BrandLogo } from "@/components/ui/BrandLogo";

/**
 * After recovery email link → /auth/callback?next=/reset-password (session set)
 * or hash tokens on this page. Then user sets a new password.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Hash recovery (implicit flow) — Supabase puts tokens in #access_token=…
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type = params.get("type");
        if (access_token && refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!cancelled) {
            if (sessErr) {
              setError(sessErr.message);
              setChecking(false);
              return;
            }
            // Clean hash from URL
            window.history.replaceState(null, "", "/reset-password");
            setReady(true);
            setChecking(false);
            return;
          }
        }
        if (type === "recovery" && access_token) {
          // partial — try getSession after detect
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setReady(true);
      } else {
        setError(
          "Ссылка недействительна или истекла. Запросите сброс пароля снова со страницы входа."
        );
      }
      setChecking(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
        setError("");
      }
    });

    void boot();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Пароль не короче 6 символов");
      return;
    }
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setDone(true);
    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-base-950 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 hero-mesh" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <GlassCard premium className="p-8 sm:p-10">
          <div className="mb-6 text-center">
            <BrandLogo size={48} className="mx-auto mb-3 rounded-2xl" priority />
            <h1 className="font-display text-2xl font-bold text-gradient">
              Новый пароль
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Придумайте пароль для входа в Desire Privé
            </p>
          </div>

          {checking && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gold-soft" size={28} />
            </div>
          )}

          {!checking && error && !ready && (
            <div className="space-y-4">
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                {error}
              </p>
              <Link href="/login?mode=forgot">
                <Button className="w-full" variant="outline">
                  Запросить ссылку снова
                </Button>
              </Link>
              <Link href="/login">
                <Button className="mt-2 w-full" variant="ghost">
                  На страницу входа
                </Button>
              </Link>
            </div>
          )}

          {!checking && ready && !done && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                  {error}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Новый пароль
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Ещё раз
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Сохранить пароль"
                )}
              </Button>
            </form>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="text-emerald-400" size={36} />
              <p className="text-sm text-warm-100">Пароль обновлён. Входим…</p>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
