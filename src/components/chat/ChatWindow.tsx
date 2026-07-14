"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  Send,
  Loader2,
  AlertTriangle,
  Shield,
  Image,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
import type { Message, ImageMessageMetadata } from "@/lib/types";
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
  };
}

export function ChatWindow({
  conversationId,
  currentUserId,
  otherUserId,
  otherUser,
}: ChatWindowProps) {
  const supabase = createClient();
  const supa = supabase as any;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<
    (Message & { plaintext?: string; imageUrl?: string })[]
  >([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [peerKey, setPeerKey] = useState<JsonWebKey | null>(null);
  const [decryptError, setDecryptError] = useState(false);
  const [sendError, setSendError] = useState("");

  // Initialize keys and fetch messages
  useEffect(() => {
    let active = true;

    async function init() {
      // Ensure we have our own key pair
      await ensureKeyPair();

      // Fetch peer's public key
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

      // Fetch messages
      const { data: msgs } = await supa
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!active) return;

      const resolved = await Promise.all(
        (msgs ?? []).map(async (msg: any) => {
          if (keyData) {
            try {
              const plain = await decryptMessage(
                { ciphertext: msg.ciphertext, iv: msg.iv },
                (keyData as any).public_key as JsonWebKey
              );
              return { ...msg, plaintext: plain };
            } catch {
              return { ...msg, plaintext: "[не удалось расшифровать]" };
            }
          }
          return msg;
        })
      );
      setMessages(resolved);
      setLoading(false);
    }

    init();
    return () => { active = false; };
  }, [conversationId, otherUserId, supabase]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Message>) => {
          const newMsg = payload.new as Message;
          if (!newMsg || newMsg.sender_id === currentUserId) return;

          if (peerKey) {
            try {
              const plain = await decryptMessage(
                { ciphertext: newMsg.ciphertext, iv: newMsg.iv },
                peerKey
              );
              setMessages((prev) => [
                ...prev,
                { ...newMsg, plaintext: plain },
              ]);
            } catch {
              setMessages((prev) => [
                ...prev,
                { ...newMsg, plaintext: "[не удалось расшифровать]" },
              ]);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, peerKey, supabase]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      messages.forEach((msg) => {
        if (msg.imageUrl) URL.revokeObjectURL(msg.imageUrl);
      });
    };
  }, []);

  // Download & decrypt image messages
  useEffect(() => {
    if (!peerKey) return;

    (async () => {
      for (const msg of messages) {
        if (msg.metadata?.type === "image" && !msg.imageUrl && msg.plaintext) {
          try {
            const meta: ImageMessageMetadata = JSON.parse(msg.plaintext);
            const { data } = await (supabase as any).storage
              .from("chat-images")
              .download(meta.storage_path);

            if (!data) continue;

            const encrypted = await data.arrayBuffer();
            const decrypted = await decryptFile(
              { ciphertext: encrypted, iv: new Uint8Array(b64ToBuf(meta.file_iv)) },
              peerKey
            );

            const blob = new Blob([decrypted], {
              type: meta.mime_type ?? "image/jpeg",
            });
            const url = URL.createObjectURL(blob);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id ? { ...m, imageUrl: url } : m
              )
            );
          } catch (err) {
            console.error("Image decrypt error:", err);
          }
        }
      }
    })();
  }, [messages, peerKey, supabase]);



  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !peerKey) return;
    setSending(true);

    try {
      const encrypted = await encryptMessage(text.trim(), peerKey);
      const { data, error } = await supa
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => [
          ...prev,
          { ...data, plaintext: text.trim() },
        ]);
        setText("");
        setSendError("");
      } else if (error) {
        setSendError("Не удалось отправить сообщение");
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

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Можно отправлять только изображения.");
      }

      previewUrl = URL.createObjectURL(file);
      const fileData = await file.arrayBuffer();
      const encrypted = await encryptFile(fileData, peerKey);

      const ext = file.name.split(".").pop() ?? "jpg";
      const storagePath = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const encryptedBlob = new Blob([encrypted.ciphertext], { type: "application/octet-stream" });
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

      const { data, error } = await (supabase as any)
        .from("messages")
        .insert({
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
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => [
          ...prev,
          { ...data, plaintext: metaPayload, imageUrl: previewUrl ?? undefined },
        ]);
        previewUrl = null;
        setSendError("");
      } else if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("Image send error:", err);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSendError(
        err?.message?.includes("bucket") || err?.message?.includes("mime")
          ? "Фото не отправилось: обновите Supabase bucket chat-images из supabase/schema.sql."
          : `Ошибка отправки фото: ${err?.message ?? "проверьте логику Storage и сообщений."}`
      );
    }

    setSending(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function bufToB64(buf: ArrayBufferLike): string {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  // Publish our public key to the server if not already there
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
    publishKey();
  }, [currentUserId, supabase]);

  return (
    <div className="flex h-full flex-1 flex-col min-h-0 p-4 md:p-6 md:pb-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/chat"
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors md:hidden"
        >
          <ArrowLeft size={16} />
        </Link>
        <Avatar
          src={otherUser.avatar_url}
          name={otherUser.display_name ?? otherUser.username}
          lastSeen={otherUser.last_seen}
          showPresence
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {otherUser.display_name ?? otherUser.username}
          </p>
          <p className="text-xs text-slate-500">
            {isOnline(otherUser.last_seen) ? "В сети" : `Был(а) ${timeAgo(otherUser.last_seen)}`}
          </p>
        </div>
        <span
          className="chat-lavender flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-2.5 py-1 text-[10px] text-gold-soft shadow-[0_0_12px_rgb(var(--gold-glow)/0.08)]"
          title="Защищено сквозным шифрованием"
        >
          <Shield size={11} />
          E2EE
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="particle-field flex-1 space-y-3 overflow-y-auto rounded-2xl border border-gold/10 bg-base-800/25 p-4"
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
            <p className="text-sm text-slate-400">
              Собеседник ещё не настроил сквозное шифрование
            </p>
            <p className="text-xs text-slate-500">
              Сообщения появятся, когда он(а) опубликует свой ключ
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="chat-lavender mb-3 grid h-12 w-12 place-items-center rounded-xl border border-gold/20 bg-gold/10 animate-pulse-glow">
              <Lock size={20} className="text-gold-soft" />
            </div>
            <p className="text-sm text-slate-300">
              🔒 Чат защищён сквозным шифрованием
            </p>
            <p className="text-xs text-slate-500">
              Никто, даже сервер, не может прочитать ваши сообщения
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender_id === currentUserId;
            const isImage = msg.metadata?.type === "image";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMine
                      ? "border border-gold/25 bg-accent-gradient text-white shadow-glow-accent dark:[text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
                      : "bg-base-900/70 text-slate-200 border border-gold/10"
                  }`}
                >
                  {isImage ? (
                    <div className="mb-1">
                      {msg.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imageUrl}
                          alt=""
                          className="max-h-72 w-auto max-w-full rounded-lg object-contain"
                        />
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-slate-400">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-xs">Загрузка изображения…</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {msg.plaintext ?? msg.ciphertext.slice(0, 20) + "…"}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${
                      isMine ? "text-white/70" : "text-slate-600"
                    }`}
                  >
                    {timeAgo(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Error */}
      {sendError && (
        <p className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {sendError}
        </p>
      )}

      {/* Input */}
      {peerKey && (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
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
            <Image size={16} />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение…"
            className="flex-1"
            maxLength={5000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !text.trim()}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
