"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReportModal } from "@/components/reports/ReportModal";

/**
 * Report a topic or comment. One open report per user per target.
 */
export function ReportButton({
  topicId,
  commentId,
  currentUserId,
  compact = false,
}: {
  topicId?: string;
  commentId?: string;
  currentUserId: string | null;
  compact?: boolean;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  if (!currentUserId) return null;
  if (!topicId && !commentId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-400"
            : "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        }
        title="Пожаловаться"
      >
        <Flag size={compact ? 12 : 14} />
        {!compact && "Жалоба"}
      </button>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        kind="content"
        title={commentId ? "Жалоба на комментарий" : "Жалоба на пост"}
        onSubmit={async ({ reasonCode, details, combined }) => {
          const row: Record<string, unknown> = {
            reporter_id: currentUserId,
            reason: combined,
            reason_code: reasonCode,
            details: details || null,
          };
          if (commentId) row.comment_id = commentId;
          else row.topic_id = topicId;

          const { error: err } = await (supabase as any)
            .from("content_reports")
            .insert(row);

          if (!err) return null;
          if (err.code === "23505") return "Вы уже жаловались на это";
          if (String(err.message).includes("content_reports")) {
            return "Жалобы ещё не настроены в БД (SQL-патч)";
          }
          // Columns reason_code/details missing — plain insert
          if (
            String(err.message).includes("reason_code") ||
            err.code === "PGRST204"
          ) {
            const plain: Record<string, unknown> = {
              reporter_id: currentUserId,
              reason: combined,
            };
            if (commentId) plain.comment_id = commentId;
            else plain.topic_id = topicId;
            const { error: e2 } = await (supabase as any)
              .from("content_reports")
              .insert(plain);
            if (!e2) return null;
            if (e2.code === "23505") return "Вы уже жаловались на это";
            return e2.message;
          }
          return err.message;
        }}
      />
    </>
  );
}
