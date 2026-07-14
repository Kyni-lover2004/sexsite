"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Loader2, Shield } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { timeAgo, isOnline } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/types";

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
  } | null;
  lastMessage: {
    ciphertext: string;
    created_at: string;
    metadata: { type: string } | null;
  } | null;
}

export function ConversationList({
  conversations,
  currentUserId,
}: {
  conversations: ConversationItem[];
  currentUserId: string;
}) {
  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6 font-display text-2xl font-bold text-gradient"
      >
        Чаты
      </motion.h1>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl border border-gold/20 bg-gold/10 animate-pulse-glow">
            <Shield size={24} className="text-gold-soft" />
          </div>
          <p className="text-slate-300">Нет диалогов</p>
          <p className="mt-1 text-sm text-slate-500">
            Зашифрованные сообщения появятся здесь после начала переписки
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv, i) => {
            const isUserA = currentUserId === conv.user_a;
            const other = conv.otherUser;
            return (
              <motion.a
                key={conv.id}
                href={`/chat/${conv.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i * 0.05, 0.25),
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
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
                    <p className="truncate text-sm font-medium text-white">
                      {other?.display_name ?? other?.username ?? "Пользователь"}
                    </p>
                    <p className="truncate text-xs">
                      {other && isOnline(other.last_seen) ? (
                        <span className="text-emerald-400 font-medium">В сети</span>
                      ) : other ? (
                        <span className="text-slate-500">Был(а) {timeAgo(other.last_seen)}</span>
                      ) : (
                        ""
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500">
                      {timeAgo(conv.updated_at)}
                    </span>
                    <span className="flex h-2 w-2 rounded-full bg-gold-soft animate-pulse-glow shadow-neon-gold" />
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
