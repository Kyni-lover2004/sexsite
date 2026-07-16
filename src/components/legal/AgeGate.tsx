"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "dp_age_confirmed_18";
const COOKIE_NAME = "dp_age_ok";

function readConfirmed(): boolean {
  if (typeof document === "undefined") return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${COOKIE_NAME}=1`));
}

function persistConfirmed() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Soft 18+ gate. Skips /legal/* so users can read terms before confirming.
 */
export function AgeGate() {
  const pathname = usePathname() || "";
  const isLegal = pathname.startsWith("/legal");
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    if (isLegal) {
      setReady(true);
      setOk(true);
      return;
    }
    setOk(readConfirmed());
    setReady(true);
  }, [isLegal]);

  if (!ready || ok || isLegal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-950/95 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-gold/25 bg-base-900 p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <BrandLogo size={56} className="mb-4 rounded-2xl" />
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ShieldAlert className="text-amber-300" size={22} />
          </div>
          <h1 className="font-display text-xl font-bold text-warm-100">
            Только 18+
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Desire Privé — закрытый клуб для взрослых. Контент и знакомства
            предназначены исключительно для лиц, достигших{" "}
            <strong className="text-warm-100">18 лет</strong>.
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-base-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
          Подтверждая возраст, вы также соглашаетесь с{" "}
          <a href="/legal/rules" className="text-gold-soft underline">
            правилами
          </a>
          ,{" "}
          <a href="/legal/terms" className="text-gold-soft underline">
            условиями
          </a>{" "}
          и{" "}
          <a href="/legal/privacy" className="text-gold-soft underline">
            политикой конфиденциальности
          </a>
          .
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => {
              persistConfirmed();
              setOk(true);
            }}
          >
            Мне есть 18 лет — продолжить
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = "https://www.google.com";
            }}
          >
            Мне нет 18 — уйти
          </Button>
        </div>
      </div>
    </div>
  );
}
