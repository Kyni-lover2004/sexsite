"use client";

import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  CONTENT_REPORT_REASONS,
  PROFILE_REPORT_REASONS,
  formatReportReason,
  type ReportReason,
} from "@/lib/data/reportReasons";
import { cn } from "@/lib/utils";

export type ReportKind = "content" | "profile";

export function ReportModal({
  open,
  onClose,
  kind,
  title,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  kind: ReportKind;
  title: string;
  onSubmit: (payload: {
    reasonCode: string;
    reasonLabel: string;
    details: string;
    combined: string;
  }) => Promise<string | null>;
}) {
  const reasons =
    kind === "profile" ? PROFILE_REPORT_REASONS : CONTENT_REPORT_REASONS;
  const [reason, setReason] = useState<ReportReason>(reasons[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function resetAndClose() {
    if (busy) return;
    setError("");
    setDone(false);
    setDetails("");
    setReason(reasons[0]);
    onClose();
  }

  async function submit() {
    setBusy(true);
    setError("");
    const d = details.trim();
    if (reason.requireDetails && d.length < 5) {
      setError("Опишите, в чём проблема (минимум 5 символов)");
      setBusy(false);
      return;
    }
    const combined = formatReportReason(reason, d);
    if (combined.length < 3) {
      setError("Укажите тему жалобы");
      setBusy(false);
      return;
    }

    const err = await onSubmit({
      reasonCode: reason.code,
      reasonLabel: reason.label,
      details: d,
      combined,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    window.setTimeout(() => {
      setDone(false);
      setDetails("");
      setReason(reasons[0]);
      onClose();
    }, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gold/20 bg-base-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-warm-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={busy}
            aria-label="Закрыть"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-base-800 disabled:opacity-50"
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
            <p className="text-xs text-slate-500">Выберите тему:</p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    reason.code === r.code
                      ? "border-gold/40 bg-gold/15 text-gold-soft"
                      : "border-gold/10 text-slate-400 hover:border-gold/25"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">
                Что не так
                {reason.requireDetails ? " (обязательно)" : " (по желанию)"}
              </p>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 800))}
                placeholder={
                  reason.requireDetails
                    ? "Опишите проблему своими словами…"
                    : "Дополнительно: что произошло, ссылки, детали…"
                }
                rows={3}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={resetAndClose}
              >
                Отменить
              </Button>
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Flag size={16} />
                )}
                Отправить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
