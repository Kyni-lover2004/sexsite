"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Cloud,
  KeyRound,
  Loader2,
  Lock,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createEncryptedBackup,
  ensureKeyPair,
  hasLocalKey,
  isRecoverySetupMarked,
  markRecoverySetupDone,
  restoreEncryptedBackup,
  type EncryptedKeyBackup,
} from "@/lib/crypto";
import {
  fetchCloudKeyBackup,
  hasCloudKeyBackup,
  publishPublicKey,
  uploadCloudKeyBackup,
} from "@/lib/e2ee-cloud";
import { createClient } from "@/lib/supabase/client";

type Mode =
  | "loading"
  | "ready"
  | "needs_setup"
  | "needs_restore"
  | "cloud_unavailable";

/**
 * Blocks chat-critical flows until:
 * - local keys exist AND recovery password is synced to cloud, or
 * - user restores from cloud with recovery password.
 *
 * Prevents silent ensureKeyPair() on a new browser (which used to
 * mint a new key and make all history permanently unreadable).
 */
export function E2eeRecoveryGate() {
  const [mode, setMode] = useState<Mode>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cloudBackup, setCloudBackup] = useState<EncryptedKeyBackup | null>(
    null
  );

  const resolve = useCallback(async () => {
    setError("");
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? null;
    setUserId(uid);

    if (!uid) {
      setMode("ready");
      return;
    }

    const local = await hasLocalKey();
    let cloud = false;
    let backup: EncryptedKeyBackup | null = null;
    try {
      cloud = await hasCloudKeyBackup(uid);
      if (cloud) {
        backup = await fetchCloudKeyBackup(uid);
        setCloudBackup(backup);
      } else {
        setCloudBackup(null);
      }
    } catch {
      // Table missing — allow app, soft-degrade
      if (!local) {
        try {
          const { publicKeyJwk } = await ensureKeyPair({ allowCreate: true });
          await publishPublicKey(uid, publicKeyJwk);
        } catch {
          /* ignore */
        }
      }
      setMode("cloud_unavailable");
      return;
    }

    if (!local && cloud && backup) {
      setMode("needs_restore");
      return;
    }

    if (!local && !cloud) {
      // First device: create keys, then force recovery password
      const { publicKeyJwk } = await ensureKeyPair({ allowCreate: true });
      await publishPublicKey(uid, publicKeyJwk);
      setMode("needs_setup");
      return;
    }

    if (local && !cloud) {
      // Local keys but never uploaded recovery — force setup (history risk)
      if (!isRecoverySetupMarked(uid)) {
        setMode("needs_setup");
        return;
      }
      // Marked locally but cloud missing (deleted row?) — ask again
      setMode("needs_setup");
      return;
    }

    // local + cloud: good
    if (local && cloud) {
      markRecoverySetupDone(uid);
      // Keep public key published
      try {
        const { publicKeyJwk } = await ensureKeyPair({ allowCreate: false });
        await publishPublicKey(uid, publicKeyJwk);
      } catch {
        /* ignore */
      }
      setMode("ready");
      return;
    }

    setMode("ready");
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  async function handleSetup() {
    if (!userId) return;
    setError("");
    if (pass.length < 8) {
      setError("Пароль восстановления — минимум 8 символов.");
      return;
    }
    if (pass !== pass2) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    try {
      await ensureKeyPair({ allowCreate: true });
      const backup = await createEncryptedBackup(pass);
      const up = await uploadCloudKeyBackup(userId, backup);
      if (!up.ok) {
        setError(up.error);
        setBusy(false);
        return;
      }
      await publishPublicKey(userId, backup.publicKeyJwk);
      markRecoverySetupDone(userId);
      setPass("");
      setPass2("");
      setMode("ready");
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить backup"
      );
    }
    setBusy(false);
  }

  async function handleRestore() {
    if (!userId || !cloudBackup) return;
    setError("");
    if (pass.length < 8) {
      setError("Введите пароль восстановления (мин. 8).");
      return;
    }
    setBusy(true);
    try {
      await restoreEncryptedBackup(cloudBackup, pass);
      await publishPublicKey(userId, cloudBackup.publicKeyJwk);
      markRecoverySetupDone(userId);
      setPass("");
      setMode("ready");
      // Reload so open chats re-decrypt with restored keys
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "BAD_PASSPHRASE"
          ? "Неверный пароль восстановления."
          : msg === "INVALID_BACKUP"
            ? "Backup повреждён."
            : "Не удалось восстановить ключи."
      );
    }
    setBusy(false);
  }

  if (mode === "loading") {
    return (
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full border border-gold/15 bg-base-900/90 px-3 py-1.5 text-[11px] text-slate-400 shadow-lg backdrop-blur">
        <Loader2 size={12} className="animate-spin text-gold-soft" />
        E2EE…
      </div>
    );
  }

  // Soft banner if table not applied — don't hard-block entire app
  if (mode === "cloud_unavailable") {
    return null;
  }

  if (mode === "ready") return null;

  const isRestore = mode === "needs_restore";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-2xl border border-gold/25 bg-base-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10">
            {isRestore ? (
              <Cloud size={20} className="text-gold-soft" />
            ) : (
              <KeyRound size={20} className="text-gold-soft" />
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-warm-100">
              {isRestore
                ? "Восстановите ключи чата"
                : "Защитите переписки"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Сквозное шифрование (E2EE)
            </p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-50/90">
          <p className="flex items-center gap-1.5 font-semibold text-amber-100">
            <AlertTriangle size={14} />
            {isRestore ? "Новое устройство / браузер" : "Обязательный шаг"}
          </p>
          {isRestore ? (
            <p>
              На этом устройстве нет приватного ключа, но в облаке есть{" "}
              <strong>зашифрованный backup</strong>. Введите пароль
              восстановления — иначе старые сообщения не откроются.{" "}
              <strong>Не создаём новый ключ</strong>, чтобы не потерять историю.
            </p>
          ) : (
            <p>
              Придумайте <strong>пароль восстановления</strong> (не пароль
              входа). Им шифруется ключ и сохраняется в ваш аккаунт. На новом
              телефоне или после очистки браузера вы введёте только этот пароль —
              история снова расшифруется. Без него переписки с этого аккаунта
              не восстановить.
            </p>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-base-900/60 p-3 text-[11px] leading-relaxed text-slate-400">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-300">
            <Shield size={12} className="text-gold-soft" />
            Что сервер видит и не видит
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <strong className="text-slate-300">Не видит:</strong> текст
              сообщений, фото в чате, пароль восстановления
            </li>
            <li>
              <strong className="text-slate-300">Видит:</strong> кто с кем
              переписывается, время сообщений, статус «печатает»
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <Input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder={
              isRestore
                ? "Пароль восстановления"
                : "Пароль восстановления (мин. 8)"
            }
            autoComplete="new-password"
          />
          {!isRestore && (
            <Input
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="Повторите пароль"
              autoComplete="new-password"
            />
          )}
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              void (isRestore ? handleRestore() : handleSetup())
            }
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Lock size={16} />
            )}
            {isRestore ? "Восстановить и открыть чаты" : "Сохранить и продолжить"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-[10px] text-slate-600">
          Пароль не отправляется на сервер. Запомните его — сброса «как в
          почте» не существует (это и есть смысл E2EE).
        </p>
      </div>
    </div>
  );
}
