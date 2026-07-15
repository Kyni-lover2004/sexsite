"use client";

import Link from "next/link";
import { MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { isOnline } from "@/lib/utils";
import type { FeedPerson } from "@/lib/types";

/** Horizontal “people nearby / new” strip mixed into the feed. */
export function PeopleStrip({
  people,
  title = "Люди рядом",
}: {
  people: FeedPerson[];
  title?: string;
}) {
  if (!people.length) return null;

  return (
    <section className="rounded-2xl border border-gold/12 bg-base-900/50 p-4 shadow-inner-glow">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-gold-soft" />
        <h2 className="text-sm font-semibold text-warm-100">{title}</h2>
        <Link
          href="/people"
          className="ml-auto text-xs text-gold-soft/80 hover:underline"
        >
          Все →
        </Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {people.map((p) => {
          const name = p.display_name ?? p.username;
          const online = isOnline(p.last_seen);
          const pro =
            !!p.premium_until && new Date(p.premium_until) > new Date();
          return (
            <div
              key={p.id}
              className="w-[7.5rem] shrink-0 rounded-xl border border-gold/10 bg-base-800/55 p-2.5 text-center"
            >
              <Link href={`/profile/${p.id}`} className="block">
                <Avatar
                  src={p.avatar_url}
                  name={name}
                  lastSeen={p.last_seen}
                  showPresence
                  size="lg"
                  className="mx-auto"
                />
                <p className="mt-2 truncate text-xs font-semibold text-warm-100">
                  {name}
                  {pro ? " ·✦" : ""}
                </p>
                <p className="mt-0.5 flex items-center justify-center gap-0.5 truncate text-[10px] text-slate-500">
                  {p.city ? (
                    <>
                      <MapPin size={9} />
                      {p.city}
                    </>
                  ) : online ? (
                    <span className="text-emerald-400">online</span>
                  ) : (
                    "участник"
                  )}
                </p>
              </Link>
              <Link
                href={`/chat/${p.id}`}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gold/15 bg-gold/5 py-1.5 text-[10px] font-medium text-gold-soft hover:bg-gold/10"
              >
                <MessageCircle size={11} />
                Написать
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
