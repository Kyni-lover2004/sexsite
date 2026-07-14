"use client";

import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface BannedScreenProps {
  bannedUntil: string | null;
  reason?: string | null;
}

export function BannedScreen({ bannedUntil, reason }: BannedScreenProps) {
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="grid min-h-svh place-items-center bg-base-950 px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-base-900/75 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-red-300">
          Доступ заблокирован
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Аккаунт временно ограничен
          {bannedUntil
            ? ` до ${new Date(bannedUntil).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : " без срока окончания"}
          .
        </p>
        {reason && (
          <p className="mt-3 rounded-xl border border-red-500/15 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {reason}
          </p>
        )}
        <Button
          variant="outline"
          className="mt-6 w-full border-red-500/25 text-red-100 hover:bg-red-500/10"
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          Выйти из аккаунта
        </Button>
      </div>
    </div>
  );
}
