"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Image as ImageIcon, Shield } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { timeAgo, isOnline } from "@/lib/utils";
import {
  decryptMessage,
  ensureKeyPair,
  hasLocalKey,
} from "@/lib/crypto";

interface ConversationItem {
  id: string;
  user_a: string;
  user_b: string;
  updated_at: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    last_seen: string;
    premium_until: string | null;
  } | null;
  lastMessage: {
    ciphertext: string;
    iv: string;
    created_at: string;
    sender_id: string;
    metadata: { type: string } | null;
  } | null;
  peerPublicKey: JsonWebKey | null;
}

export function ConversationList({
  conversations,
  currentUserId,
}: {
  conversations: ConversationItem[];
  currentUserId: string;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function decryptPreviews() {
      const local = await hasLocalKey();
      if (!cancelled) setHasKey(local);
      if (!local) {
        await ensureKeyPair();
      }

      const next: Record<string, string> = {};

      await Promise.all(
        conversations.map(async (conv) => {
          const last = conv.lastMessage;
          if (!last) {
            next[conv.id] = "Нет сообщений";
            return;
          }
          if (last.metadata?.type === "image") {
            next[conv.id] = "📷 Фото";
            return;
          }
          if (!conv.peerPublicKey || !last.iv) {
            next[conv.id] = "Зашифрованное сообщение";
            return;
          }
          try {
            const plain = await decryptMessage(
              { ciphertext: last.ciphertext, iv: last.iv },
              conv.peerPublicKey
            );
            const prefix =
              last.sender_id === currentUserId ? "Вы: " : "";
            next[conv.id] = prefix + plain.slice(0, 80);
          } catch {
            next[conv.id] = "🔒 Не удалось расшифровать";
          }
        })
      );

      if (!cancelled) setPreviews(next);
    }

    void decryptPreviews();
    return () => {
      cancelled = true;
    };
  }, [conversations, currentUserId]);

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-2 font-display text-2xl font-bold text-gradient"
      >
        Чаты
      </motion.h1>
      <p className="mb-5 text-xs text-slate-500">
        Сообщения с сквозным шифрованием. Превью расшифровывается только на
        этом устройстве.
      </p>

      {hasKey === false && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          Локальный ключ не найден или новый браузер — старые переписки могут не
          открыться. Откройте любой чат → 🔑 ключи → восстановите backup.
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center">
          <div className="chat-lavender mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl border border-gold/20 bg-gold/10 animate-pulse-glow">
            <Shield size={24} className="text-gold-soft" />
          </div>
          <p className="text-slate-300">Пока нет диалогов</p>
          <p className="mt-1 text-sm text-slate-500">
            Найдите человека в поиске и нажмите «Написать» — переписка появится
            здесь
          </p>
          <Link
            href="/people"
            className="mt-4 inline-block text-sm font-medium text-gold-soft hover:underline"
          >
            Перейти к людям →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv, i) => {
            const other = conv.otherUser;
            const hasPremium =
              !!other?.premium_until &&
              new Date(other.premium_until) > new Date();
            const preview =
              previews[conv.id] ??
              (conv.lastMessage?.metadata?.type === "image"
                ? "📷 Фото"
                : conv.lastMessage
                  ? "…"
                  : "Нет сообщений");

            return (
              <motion.a
                key={conv.id}
                href={`/chat/${conv.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i * 0.04, 0.2),
                  duration: 0.28,
                }}
                className="block"
              >
                <GlassCard
                  interactive
                  className="flex items-center gap-3 p-3"
                >
                  <Avatar
                    src={other?.avatar_url}
                    name={other?.display_name ?? other?.username}
                    lastSeen={other?.last_seen}
                    showPresence
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                      {other?.display_name ??
                        other?.username ??
                        "Пользователь"}
                      {hasPremium && (
                        <Crown
                          size={13}
                          className="shrink-0 fill-current text-gold-soft drop-shadow-[0_0_8px_rgb(var(--gold-glow)/0.45)]"
                        />
                      )}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                      {conv.lastMessage?.metadata?.type === "image" && (
                        <ImageIcon size={11} className="shrink-0 opacity-70" />
                      )}
                      {preview}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-500">
                      {timeAgo(
                        conv.lastMessage?.created_at ?? conv.updated_at
                      )}
                    </span>
                    {other && isOnline(other.last_seen) && (
                      <span className="text-[10px] font-medium text-emerald-400">
                        online
                      </span>
                    )}
                  </div>
                </GlassCard>
              </motion.a>
            );
          })}
        </div>
      )}
    </div>
  );
}
