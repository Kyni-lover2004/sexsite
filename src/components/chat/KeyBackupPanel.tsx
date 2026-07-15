"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  KeyRound,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  canExportBackup,
  createEncryptedBackup,
  ensureKeyPair,
  publicKeyFingerprint,
  restoreEncryptedBackup,
  type EncryptedKeyBackup,
} from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";

/**
 * Honest E2EE key story + passphrase-encrypted backup export/import.
 * Without a backup, a new browser cannot decrypt old history.
 */
export function KeyBackupPanel({
  open,
  onClose,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [restorePass, setRestorePass] = useState("");
  const [fp, setFp] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      await ensureKeyPair();
      setFp(await publicKeyFingerprint());
      setCanExport(await canExportBackup());
    })();
  }, [open]);

  if (!open) return null;

  async function handleExport() {
    setError("");
    setOk("");
    if (pass.length < 8) {
      setError("Пароль backup — минимум 8 символов.");
      return;
    }
    if (pass !== pass2) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      const backup = await createEncryptedBackup(pass);
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `desire-prive-e2ee-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOk("Backup скачан. Храните файл и пароль в безопасном месте.");
      setPass("");
      setPass2("");
    } catch (e: any) {
      setError(
        e?.message === "LEGACY_NON_EXTRACTABLE"
          ? "Старый ключ нельзя экспортировать. Создайте новый backup после переустановки ключей недоступна — только на новых устройствах после экспорта."
          : e?.message ?? "Не удалось создать backup"
      );
    }
    setBusy(false);
  }

  async function handleImport(file: File) {
    setError("");
    setOk("");
    if (restorePass.length < 8) {
      setError("Введите пароль backup (мин. 8 символов).");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as EncryptedKeyBackup;
      await restoreEncryptedBackup(backup, restorePass);

      // Re-publish public key (same if same backup; needed if server empty).
      const supabase = createClient();
      await (supabase as any)
        .from("encryption_keys")
        .upsert({
          user_id: currentUserId,
          public_key: backup.publicKeyJwk,
          updated_at: new Date().toISOString(),
        });

      setOk(
        "Ключи восстановлены. Обновите страницу чата — история должна расшифроваться."
      );
      setRestorePass("");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      const msg = e?.message;
      setError(
        msg === "BAD_PASSPHRASE"
          ? "Неверный пароль backup."
          : msg === "INVALID_BACKUP"
            ? "Файл backup повреждён."
            : "Не удалось восстановить ключи."
      );
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <div className="max-h-[90svh] w-full max-w-md overflow-y-auto rounded-2xl border border-gold/20 bg-base-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-gold/25 bg-gold/10">
              <KeyRound size={18} className="text-gold-soft" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-warm-100">
                Ключи E2EE
              </h2>
              <p className="text-xs text-slate-500">Backup и восстановление</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-base-800"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100/90">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} />
            Честно про безопасность
          </p>
          <p>
            Приватный ключ хранится <strong>только в этом браузере</strong>.
            Сервер видит лишь шифротекст. Новый браузер / очистка данных ={" "}
            <strong>история не расшифруется</strong>, пока вы не восстановите
            backup.
          </p>
          {fp && (
            <p className="mt-2 font-mono text-[11px] text-amber-100/70">
              Отпечаток ключа: {fp}
            </p>
          )}
        </div>

        {!canExport && (
          <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            На этом устройстве ключ создан в старом формате — экспорт невозможен.
            Backup заработает после новой генерации на чистом профиле браузера.
          </p>
        )}

        <section className="mb-5 space-y-2">
          <h3 className="text-sm font-semibold text-warm-100">
            Скачать backup
          </h3>
          <Input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Пароль для файла (мин. 8)"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            placeholder="Повторите пароль"
            autoComplete="new-password"
          />
          <Button
            className="w-full"
            disabled={busy || !canExport}
            onClick={handleExport}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Скачать encrypted backup
          </Button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-warm-100">
            Восстановить на этом устройстве
          </h3>
          <Input
            type="password"
            value={restorePass}
            onChange={(e) => setRestorePass(e.target.value)}
            placeholder="Пароль backup"
            autoComplete="current-password"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} />
            Выбрать файл backup
          </Button>
        </section>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
        {ok && (
          <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {ok}
          </p>
        )}
      </div>
    </div>
  );
}
