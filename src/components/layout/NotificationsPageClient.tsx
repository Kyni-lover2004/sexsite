"use client";

import Link from "next/link";
import {
  Bell,
  Eye,
  Heart,
  Headphones,
  MessageCircle,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

function iconFor(type: string) {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
      return <UserPlus size={16} className="text-gold-soft" />;
    case "guest":
      return <Eye size={16} className="text-gold-soft" />;
    case "chat_message":
      return <MessageCircle size={16} className="text-gold-soft" />;
    case "support_reply":
      return <Headphones size={16} className="text-gold-soft" />;
    case "topic_comment":
      return <MessageSquare size={16} className="text-gold-soft" />;
    case "profile_like":
      return <Heart size={16} className="text-rose-300" />;
    default:
      return <Bell size={16} className="text-gold-soft" />;
  }
}

export function NotificationsPageClient({
  initialItems,
  loadError,
}: {
  initialItems: AppNotification[];
  loadError?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-warm-100">
          Уведомления
        </h1>
        <p className="text-sm text-slate-500">
          Заявки, гости, сообщения, ответы поддержки и комментарии
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          Таблица уведомлений ещё не создана. Выполните SQL{" "}
          <code className="text-xs">supabase/patch_notifications.sql</code> в
          Supabase.
        </div>
      )}

      {!loadError && initialItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/15 p-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-slate-300">Пока нет уведомлений</p>
          <p className="mt-1 text-sm text-slate-500">
            Когда кто-то напишет, зайдёт в гости или оставит комментарий — будет
            здесь
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initialItems.map((n) => {
            const content = (
              <div className="flex gap-3 rounded-2xl border border-gold/10 bg-base-800/50 p-3 transition-colors hover:border-gold/25">
                {n.actor ? (
                  <Avatar
                    src={n.actor.avatar_url}
                    name={n.actor.display_name ?? n.actor.username}
                    size="md"
                  />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/15 bg-base-900">
                    {iconFor(n.type)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-warm-100">
                    {iconFor(n.type)}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {timeAgo(n.created_at)}
                    {n.read_at ? "" : " · новое"}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
