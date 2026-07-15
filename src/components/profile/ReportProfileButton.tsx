"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReportModal } from "@/components/reports/ReportModal";
import { cn } from "@/lib/utils";

/**
 * Flag to report a user profile → admin «Жалобы на людей».
 */
export function ReportProfileButton({
  reportedUserId,
  currentUserId,
  className,
  compact = false,
}: {
  reportedUserId: string;
  currentUserId: string | null;
  className?: string;
  compact?: boolean;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  if (!currentUserId || currentUserId === reportedUserId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1 text-[11px] text-red-300/90 hover:bg-red-500/10"
            : "inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-200",
          className
        )}
        title="Пожаловаться на пользователя"
      >
        <Flag size={compact ? 12 : 14} />
        {compact ? "Жалоба" : "Пожаловаться"}
      </button>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        kind="profile"
        title="Жалоба на пользователя"
        onSubmit={async ({ reasonCode, reasonLabel, details }) => {
          const { error } = await (supabase as any).from("profile_reports").insert({
            reporter_id: currentUserId,
            reported_user_id: reportedUserId,
            reason_code: reasonCode,
            reason_label: reasonLabel,
            details: details || "",
          });

          if (!error) return null;
          if (error.code === "23505") {
            return "У вас уже есть открытая жалоба на этого человека";
          }
          if (String(error.message).includes("profile_reports")) {
            return "Жалобы на людей ещё не настроены (выполните SQL-патч)";
          }
          return error.message;
        }}
      />
    </>
  );
}
