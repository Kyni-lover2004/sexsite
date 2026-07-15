"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CornerUpLeft,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  AlertTriangle,
  Send,
  Shield,
  Crown,
  X,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KeyBackupPanel } from "@/components/chat/KeyBackupPanel";
import { timeAgo, isOnline } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  ensureKeyPair,
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  b64ToBuf,
} from "@/lib/crypto";
import type { ChatMessage, ImageMessageMetadata, Message } from "@/lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    last_seen: string;
    premium_until?: string | null;
  };
  /** True when conversation was just created / never had messages. */
  isBrandNew?: boolean;
}

function bufToB64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function ChatWindow({
  conversationId,
  currentUserId,
  otherUserId,
  otherUser,
  isBrandNew = false,
}: ChatWindowProps) {
  const supabase = useMemo(() => createClient(), []);
  const supa = supabase as any;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [peerKey, setPeerKey] = useState<JsonWebKey | null>(null);
  const [decryptError, setDecryptError] = useState(false);
  const [sendError, setSendError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [historyLostHint, setHistoryLostHint] = useState(false);

  const otherUserPremium =
    !!otherUser.premium_until &&
    new Date(otherUser.premium_until) > new Date();
  const displayName = otherUser.display_name ?? otherUser.username;

  const msgById = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    for (const msg of messages) m.set(msg.id, msg);
    return m;
  }, [messages]);

  const markRead = useCallback(async () => {
    await supa
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("sender_id", otherUserId)
      .is("read_at", null);
  }, [conversationId, otherUserId, supa]);

  // ---- load history ----
  useEffect(() => {
    let active = true;

    async function init() {
      await ensureKeyPair();

      const { data: keyData } = await supa
        .from("encryption_keys")
        .select("public_key")
        .eq("user_id", otherUserId)
        .maybeSingle();

      if (keyData) {
        setPeerKey(keyData.public_key as JsonWebKey);
        setDecryptError(false);
      } else {
        setDecryptError(true);
      }

      const { data: msgs } = await supa
        .from("messages")
        .select(
          "id, conversation_id, sender_id, ciphertext, iv, ephemeral_key, metadata, read_at, created_at, reply_to_id"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(120);

      if (!active) return;

      const chronological = [...(msgs ?? [])].reverse();
      const peerJwk = keyData
        ? ((keyData as any).public_key as JsonWebKey)
        : null;

      let failed = 0;
      const resolved: ChatMessage[] = await Promise.all(
        chronological.map(async (msg: any) => {
          if (peerJwk) {
            try {
              const plain = await decryptMessage(
                { ciphertext: msg.ciphertext, iv: msg.iv },
                peerJwk
              );
              return { ...msg, plaintext: plain } as ChatMessage;
            } catch {
              failed++;
              return {
                ...msg,
                plaintext: "[не удалось расшифровать]",
              } as ChatMessage;
            }
          }
          return msg as ChatMessage;
        })
      );

      // Attach quote previews from local window.
      const byId = new Map(resolved.map((m) => [m.id, m]));
      for (const m of resolved) {
        if (m.reply_to_id && byId.has(m.reply_to_id)) {
          const parent = byId.get(m.reply_to_id)!;
          m.replyPreview =
            parent.metadata?.type === "image"
              ? "📷 Фото"
              : (parent.plaintext ?? "…").slice(0, 120);
        } else if (m.reply_to_id) {
          m.replyPreview = "Ответ на сообщение";
        }
      }

      setMessages(resolved);
      if (resolved.length > 0 && failed > resolved.length * 0.5) {
        setHistoryLostHint(true);
      }
      setLoading(false);
      void markRead();
    }

    void init();
    return () => {
      active = false;
    };
  }, [conversationId, otherUserId, supa, markRead]);

  // ---- realtime: messages + read + typing broadcast ----
  useEffect(() => {
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Message>) => {
          const newMsg = payload.new as Message & { reply_to_id?: string };
          if (!newMsg?.id) return;
          if (newMsg.sender_id === currentUserId) return;

          let plaintext = "";
          if (peerKey) {
            try {
              plaintext = await decryptMessage(
                { ciphertext: newMsg.ciphertext, iv: newMsg.iv },
                peerKey
              );
            } catch {
              plaintext = "[не удалось расшифровать]";
            }
          }

          let replyPreview: string | null = null;
          if (newMsg.reply_to_id) {
            setMessages((prev) => {
              const parent = prev.find((m) => m.id === newMsg.reply_to_id);
              replyPreview = parent
                ? parent.metadata?.type === "image"
                  ? "📷 Фото"
                  : (parent.plaintext ?? "…").slice(0, 120)
                : "Ответ на сообщение";
              return prev;
            });
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const parent = prev.find((m) => m.id === newMsg.reply_to_id);
            const preview = parent
              ? parent.metadata?.type === "image"
                ? "📷 Фото"
                : (parent.plaintext ?? "…").slice(0, 120)
              : newMsg.reply_to_id
                ? "Ответ на сообщение"
                : null;
            return [
              ...prev,
              {
                ...newMsg,
                plaintext,
                replyPreview: preview ?? replyPreview,
              },
            ];
          });
          setPeerTyping(false);
          void markRead();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const updated = payload.new as Message;
          if (!updated?.id || !updated.read_at) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...m, read_at: updated.read_at } : m
            )
          );
        }
      )
      .on(
        "broadcast",
        { event: "typing" },
        (payload: { payload?: { userId?: string } }) => {
          const uid = payload.payload?.userId;
          if (uid && uid !== currentUserId) {
            setPeerTyping(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setPeerTyping(false), 2800);
          }
        }
      )
      .subscribe();

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, peerKey, supabase, markRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, peerTyping]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  // Decrypt images
  useEffect(() => {
    if (!peerKey) return;
    const pending = messages.filter(
      (msg) =>
        msg.metadata?.type === "image" && !msg.imageUrl && msg.plaintext
    );
    if (pending.length === 0) return;
    let cancelled = false;

    (async () => {
      const updates = await Promise.all(
        pending.map(async (msg) => {
          try {
            const meta: ImageMessageMetadata = JSON.parse(msg.plaintext!);
            const { data } = await (supabase as any).storage
              .from("chat-images")
              .download(meta.storage_path);
            if (!data) return null;
            const encrypted = await data.arrayBuffer();
            const decrypted = await decryptFile(
              {
                ciphertext: encrypted,
                iv: new Uint8Array(b64ToBuf(meta.file_iv)),
              },
              peerKey
            );
            const blob = new Blob([decrypted], {
              type: meta.mime_type ?? "image/jpeg",
            });
            const url = URL.createObjectURL(blob);
            objectUrlsRef.current.add(url);
            return { id: msg.id, url };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const byId = new Map(
        updates.filter(Boolean).map((u) => [u!.id, u!.url] as const)
      );
      if (byId.size === 0) return;
      setMessages((prev) =>
        prev.map((m) =>
          byId.has(m.id) ? { ...m, imageUrl: byId.get(m.id) } : m
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, peerKey, supabase]);

  // Publish public key
  useEffect(() => {
    async function publishKey() {
      const { publicKeyJwk } = await ensureKeyPair();
      const { data: existing } = await supa
        .from("encryption_keys")
        .select("user_id")
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (!existing) {
        await supa.from("encryption_keys").insert({
          user_id: currentUserId,
          public_key: publicKeyJwk,
        });
      }
    }
    void publishKey();
  }, [currentUserId, supa]);

  function broadcastTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 1200) return;
    lastTypingSent.current = now;
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !peerKey) return;
    setSending(true);
    const body = text.trim();
    const replyId = replyTo?.id ?? null;
    const replyPreviewText = replyTo
      ? replyTo.metadata?.type === "image"
        ? "📷 Фото"
        : (replyTo.plaintext ?? "…").slice(0, 120)
      : null;

    try {
      const encrypted = await encryptMessage(body, peerKey);
      const { data, error } = await supa
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          reply_to_id: replyId,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => [
          ...prev,
          {
            ...data,
            plaintext: body,
            reply_to_id: replyId,
            replyPreview: replyPreviewText,
          },
        ]);
        setText("");
        setReplyTo(null);
        setSendError("");
      } else if (error) {
        // Column may be missing before migration — retry without reply_to.
        if (replyId && String(error.message).includes("reply_to")) {
          const retry = await supa
            .from("messages")
            .insert({
              conversation_id: conversationId,
              sender_id: currentUserId,
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
            })
            .select()
            .single();
          if (!retry.error && retry.data) {
            setMessages((prev) => [
              ...prev,
              { ...retry.data, plaintext: body },
            ]);
            setText("");
            setReplyTo(null);
            setSendError("");
          } else {
            setSendError("Не удалось отправить сообщение");
          }
        } else {
          setSendError("Не удалось отправить сообщение");
        }
      }
    } catch (err) {
      console.error("Send error:", err);
      setSendError("Ошибка отправки");
    }
    setSending(false);
  }

  async function handleImageSend(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !peerKey) return;
    setSending(true);
    setSendError("");
    let previewUrl: string | null = null;
    const replyId = replyTo?.id ?? null;

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Можно отправлять только изображения.");
      }
      previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(previewUrl);
      const fileData = await file.arrayBuffer();
      const encrypted = await encryptFile(fileData, peerKey);
      const ext = file.name.split(".").pop() ?? "jpg";
      const storagePath = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const encryptedBlob = new Blob([encrypted.ciphertext], {
        type: "application/octet-stream",
      });
      const { error: uploadError } = await (supabase as any).storage
        .from("chat-images")
        .upload(storagePath, encryptedBlob, {
          contentType: "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const fileIv = bufToB64(encrypted.iv.buffer);
      const metaPayload = JSON.stringify({
        storage_path: storagePath,
        file_iv: fileIv,
        mime_type: file.type,
      });
      const encryptedMeta = await encryptMessage(metaPayload, peerKey);
      const insertBody: Record<string, unknown> = {
        conversation_id: conversationId,
        sender_id: currentUserId,
        ciphertext: encryptedMeta.ciphertext,
        iv: encryptedMeta.iv,
        metadata: {
          type: "image",
          storage_path: storagePath,
          file_iv: fileIv,
          mime_type: file.type,
        },
      };
      if (replyId) insertBody.reply_to_id = replyId;

      const { data, error } = await (supabase as any)
        .from("messages")
        .insert(insertBody)
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => [
          ...prev,
          {
            ...data,
            plaintext: metaPayload,
            imageUrl: previewUrl ?? undefined,
            replyPreview: replyTo
              ? (replyTo.plaintext ?? "…").slice(0, 120)
              : null,
          },
        ]);
        previewUrl = null;
        setReplyTo(null);
        setSendError("");
      } else if (error) throw error;
    } catch (err: any) {
      console.error("Image send error:", err);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        objectUrlsRef.current.delete(previewUrl);
      }
      setSendError(
        `Ошибка отправки фото: ${err?.message ?? "проверьте Storage."}`
      );
    }
    setSending(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const emptyIsNew = messages.length === 0 && (isBrandNew || messages.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-3 pb-4 sm:p-4 md:p-6 md:pb-4">
      {/* Header */}
      <div className="mb-3 flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/chat"
          className="flex shrink-0 items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white md:hidden"
        >
          <ArrowLeft size={16} />
        </Link>
        <Link
          href={`/profile/${otherUser.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 transition-opacity hover:opacity-85"
        >
          <Avatar
            src={otherUser.avatar_url}
            name={displayName}
            lastSeen={otherUser.last_seen}
            showPresence
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
              {displayName}
              {otherUserPremium && (
                <Crown
                  size={13}
                  className="shrink-0 fill-current text-gold-soft drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.45)]"
                />
              )}
            </p>
            <p className="text-xs text-slate-500">
              {peerTyping ? (
                <span className="text-gold-soft animate-pulse">печатает…</span>
              ) : isOnline(otherUser.last_seen) ? (
                "В сети"
              ) : (
                `Был(а) ${timeAgo(otherUser.last_seen)}`
              )}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setBackupOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/5 text-gold-soft hover:bg-gold/10"
          title="Ключи и backup E2EE"
        >
          <KeyRound size={16} />
        </button>
        <span
          className="chat-lavender flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-2 py-1 text-[10px] text-gold-soft sm:px-2.5"
          title="Защищено сквозным шифрованием"
        >
          <Shield size={11} />
          <span className="hidden min-[360px]:inline">E2EE</span>
        </span>
      </div>

      {historyLostHint && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            Часть сообщений не расшифровалась — возможно, другой браузер или
            ключи сброшены.{" "}
            <button
              type="button"
              className="underline text-gold-soft"
              onClick={() => setBackupOpen(true)}
            >
              Восстановить backup
            </button>
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="particle-field flex-1 space-y-3 overflow-y-auto rounded-2xl border border-gold/10 bg-base-800/25 p-3 sm:p-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold-soft" />
          </div>
        ) : !peerKey ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="chat-lavender mb-3 grid h-12 w-12 place-items-center rounded-xl border border-gold/20 bg-gold/10">
              <AlertTriangle size={20} className="text-gold-soft" />
            </div>
            <p className="text-sm text-slate-300">
              {displayName} ещё не настроил(а) шифрование
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Когда собеседник откроет чат, ключ появится и можно будет писать
              безопасно
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="chat-lavender mb-3 grid h-12 w-12 place-items-center rounded-xl border border-gold/20 bg-gold/10 animate-pulse-glow">
              <Lock size={20} className="text-gold-soft" />
            </div>
            {emptyIsNew || isBrandNew ? (
              <>
                <p className="text-sm font-medium text-warm-100">
                  Новый диалог с {displayName}
                </p>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
                  Напишите первое сообщение. Чат защищён E2EE: сервер не читает
                  текст. Ключи только в браузере — сохраните{" "}
                  <button
                    type="button"
                    className="text-gold-soft underline"
                    onClick={() => setBackupOpen(true)}
                  >
                    backup
                  </button>
                  , если смените устройство.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">Нет сообщений в окне</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  История пуста или не расшифровалась на этом устройстве
                </p>
              </>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            const isImage = msg.metadata?.type === "image";
            const quote =
              msg.replyPreview ??
              (msg.reply_to_id
                ? msgById.get(msg.reply_to_id)?.plaintext?.slice(0, 120)
                : null);

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`group flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[88%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[80%] sm:px-4 ${
                    isMine
                      ? "border border-gold/25 bg-accent-gradient text-white shadow-glow-accent dark:[text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
                      : "border border-gold/10 bg-base-900/70 text-slate-200"
                  }`}
                >
                  {quote && (
                    <div
                      className={`mb-1.5 border-l-2 pl-2 text-[11px] leading-snug opacity-80 ${
                        isMine
                          ? "border-white/40 text-white/80"
                          : "border-gold/40 text-slate-400"
                      }`}
                    >
                      {quote}
                    </div>
                  )}
                  {isImage ? (
                    <div className="mb-1">
                      {msg.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          src={msg.imageUrl}
                          className="max-h-72 w-auto max-w-full rounded-lg object-contain"
                        />
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-slate-400">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-xs">Загрузка…</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {msg.plaintext ?? "…"}
                    </p>
                  )}
                  <div
                    className={`mt-1 flex items-center gap-1.5 ${
                      isMine ? "justify-end text-white/70" : "text-slate-600"
                    }`}
                  >
                    <span className="text-[10px]">{timeAgo(msg.created_at)}</span>
                    {isMine &&
                      (msg.read_at ? (
                        <span title="Прочитано">
                          <CheckCheck size={12} className="text-sky-300" />
                        </span>
                      ) : (
                        <span title="Отправлено">
                          <Check size={12} />
                        </span>
                      ))}
                    {!isMine && peerKey && (
                      <button
                        type="button"
                        onClick={() => setReplyTo(msg)}
                        className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                        title="Ответить"
                      >
                        <CornerUpLeft size={12} />
                      </button>
                    )}
                    {isMine && peerKey && (
                      <button
                        type="button"
                        onClick={() => setReplyTo(msg)}
                        className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                        title="Ответить"
                      >
                        <CornerUpLeft size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {peerTyping && peerKey && messages.length > 0 && (
          <p className="pl-1 text-xs text-gold-soft/90 animate-pulse">
            {displayName} печатает…
          </p>
        )}
      </div>

      {sendError && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {sendError}
        </p>
      )}

      {replyTo && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-gold/15 bg-base-900/60 px-3 py-2 text-xs">
          <CornerUpLeft size={14} className="shrink-0 text-gold-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-gold-soft/70">
              Ответ
            </p>
            <p className="truncate text-slate-300">
              {replyTo.metadata?.type === "image"
                ? "📷 Фото"
                : (replyTo.plaintext ?? "…").slice(0, 100)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-base-800"
            aria-label="Отменить ответ"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {peerKey && (
        <form onSubmit={handleSend} className="mt-3 flex min-w-0 gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSend}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            title="Отправить фото"
          >
            <ImageIcon size={16} />
          </Button>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              broadcastTyping();
            }}
            placeholder="Сообщение…"
            className="min-w-0 flex-1"
            maxLength={5000}
          />
          <Button type="submit" size="icon" disabled={sending || !text.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </form>
      )}

      <KeyBackupPanel
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        currentUserId={currentUserId}
      />
    </div>
  );
}
