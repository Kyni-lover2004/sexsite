"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Image as ImageIcon, Shield } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { timeAgo, isPubliclyOnline, publicLastSeen } from "@/lib/utils";
import {
  decryptMessage,
  ensureKeyPair,
  hasLocalKey,
} from "@/lib/crypto";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

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
    is_invisible?: boolean;
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
  const [decrypting, setDecrypting] = useState(conversations.length > 0);

  useEffect(() => {
    let cancelled = false;

    async function decryptPreviews() {
      if (conversations.length === 0) {
        setDecrypting(false);
        return;
      }
      setDecrypting(true);
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

      if (!cancelled) {
        setPreviews(next);
        setDecrypting(false);
      }
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
        <EmptyState
          icon={<Shield size={22} />}
          title="Пока нет диалогов"
          description="Найдите человека в поиске и нажмите «Написать» — переписка появится здесь"
          actionLabel="Смотреть людей"
          actionHref="/people"
        />
      ) : decrypting && Object.keys(previews).length === 0 ? (
        <SkeletonList count={5} variant="chat" />
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
                    lastSeen={publicLastSeen(
                      other?.last_seen,
                      other?.is_invisible
                    )}
                    showPresence={!other?.is_invisible}
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
                    {other &&
                      isPubliclyOnline(
                        other.last_seen,
                        other.is_invisible
                      ) && (
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
