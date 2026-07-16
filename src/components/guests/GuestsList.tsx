"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HeartHandshake,
  MessageCircle,
  UserPlus,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GuestFriendStatus, GuestListItem } from "@/lib/types";

export function GuestsList({ initialGuests }: { initialGuests: GuestListItem[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [guests, setGuests] = useState(initialGuests);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function sendFriend(guestId: string) {
    setBusyId(guestId);
    const { data, error } = await (supabase as any).rpc("request_friendship", {
      p_other_id: guestId,
    });
    setBusyId(null);

    if (error) {
      console.error(error);
      haptic("warning");
      return;
    }

    let next: GuestFriendStatus = "sent";
    if (data === "accepted" || data === "already") next = "accepted";
    else if (data === "sent") next = "sent";

    haptic(next === "accepted" ? "success" : "medium");
    setGuests((prev) =>
      prev.map((g) =>
        g.visitor.id === guestId ? { ...g, friendStatus: next } : g
      )
    );
    if (next === "accepted") router.refresh();
  }

  async function acceptFriend(guestId: string) {
    setBusyId(guestId);
    const { data, error } = await (supabase as any).rpc("accept_friendship", {
      p_other_id: guestId,
    });
    setBusyId(null);
    if (error) {
      console.error(error);
      haptic("warning");
      return;
    }
    if (data === "accepted" || data === "already") {
      haptic("success");
      setGuests((prev) =>
        prev.map((g) =>
          g.visitor.id === guestId
            ? { ...g, friendStatus: "accepted" as const }
            : g
        )
      );
      router.refresh();
    }
  }

  if (guests.length === 0) {
    return (
      <EmptyState
        icon={<EyeEmpty />}
        title="За последние 24 часа гостей не было"
        description="Когда кто-то откроет вашу анкету — он появится здесь"
        actionLabel="Смотреть людей"
        actionHref="/people"
      />
    );
  }

  return (
    <div className="space-y-2">
      {guests.map((guest) => {
        const v = guest.visitor;
        const name = v.display_name ?? v.username;
        const loading = busyId === v.id;

        return (
          <article
            key={guest.visitId}
            className={`rounded-2xl border p-3 transition-colors ${
              guest.isNew
                ? "border-gold/25 bg-gold/[0.06] shadow-[0_0_24px_rgb(var(--gold-glow)/0.06)]"
                : "border-gold/10 bg-base-800/55"
            }`}
          >
            <div className="flex items-start gap-3">
              <Link href={`/profile/${v.id}`} className="shrink-0">
                <Avatar
                  src={v.avatar_url}
                  name={name}
                  lastSeen={v.is_invisible ? null : (v.last_seen ?? undefined)}
                  showPresence={!v.is_invisible}
                  size="md"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/profile/${v.id}`}
                    className="truncate font-semibold text-warm-100 hover:text-gold-soft"
                  >
                    {name}
                  </Link>
                  {guest.isNew && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-gold/30 bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">
                      <Sparkles size={10} />
                      новый
                    </span>
                  )}
                  {guest.isMutual && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full border border-rose-400/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300"
                      title="Вы тоже заходили к этому человеку"
                    >
                      <HeartHandshake size={10} />
                      взаимно
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">@{v.username}</p>
                <time className="mt-0.5 block text-[11px] text-slate-500">
                  {timeAgo(guest.visitedAt)} ·{" "}
                  {new Date(guest.visitedAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Link href={`/chat/${v.id}`}>
                    <Button size="sm" className="h-9 px-3 text-xs">
                      <MessageCircle size={14} />
                      Написать
                    </Button>
                  </Link>

                  {guest.friendStatus === "none" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      disabled={loading}
                      onClick={() => sendFriend(v.id)}
                    >
                      {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      В друзья
                    </Button>
                  )}
                  {guest.friendStatus === "sent" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      disabled
                    >
                      Заявка отправлена
                    </Button>
                  )}
                  {guest.friendStatus === "received" && (
                    <Button
                      size="sm"
                      className="h-9 border border-emerald-500/30 bg-emerald-600/20 px-3 text-xs text-emerald-300 hover:bg-emerald-600/35"
                      disabled={loading}
                      onClick={() => acceptFriend(v.id)}
                    >
                      {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Принять заявку
                    </Button>
                  )}
                  {guest.friendStatus === "accepted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-3 text-xs text-emerald-400/90"
                      disabled
                    >
                      <Check size={14} />
                      В друзьях
                    </Button>
                  )}

                  <Link href={`/profile/${v.id}`}>
                    <Button size="sm" variant="ghost" className="h-9 px-3 text-xs text-slate-400">
                      Анкета
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EyeEmpty() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
