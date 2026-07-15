"use client";

import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

const REASONS = [
  "Спам / реклама",
  "Оскорбления",
  "Неприемлемый контент",
  "Мошенничество",
  "Другое",
];

/**
 * Report a topic or comment. One report per user per target (DB unique).
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
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!currentUserId) return null;
  if (!topicId && !commentId) return null;

  async function submit() {
    setBusy(true);
    setError("");
    const text = [reason, details.trim()].filter(Boolean).join(": ").slice(0, 500);
    if (text.length < 3) {
      setError("Укажите причину");
      setBusy(false);
      return;
    }

    const row: Record<string, unknown> = {
      reporter_id: currentUserId,
      reason: text,
    };
    if (commentId) row.comment_id = commentId;
    else row.topic_id = topicId;

    const { error: err } = await (supabase as any)
      .from("content_reports")
      .insert(row);

    setBusy(false);
    if (err) {
      if (err.code === "23505") {
        setError("Вы уже жаловались на это");
      } else if (String(err.message).includes("content_reports")) {
        setError("Жалобы ещё не настроены в БД (примените SQL-патч)");
      } else {
        setError(err.message);
      }
      return;
    }
    setDone(true);
    setTimeout(() => {
      setOpen(false);
      setDone(false);
      setDetails("");
    }, 1200);
  }

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

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 sm:items-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gold/20 bg-base-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-warm-100">
                Пожаловаться
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-base-800"
              >
                <X size={18} />
              </button>
            </div>

            {done ? (
              <p className="py-6 text-center text-sm text-emerald-300">
                Жалоба отправлена. Модераторы проверят.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        reason === r
                          ? "border-gold/40 bg-gold/15 text-gold-soft"
                          : "border-gold/10 text-slate-400 hover:border-gold/25"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 400))}
                  placeholder="Подробности (необязательно)"
                  rows={3}
                />
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={submit}
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Flag size={16} />
                  )}
                  Отправить жалобу
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
