"use client";
import { CheckCircle2, MessageSquare, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { Profile } from "@/lib/types";
import { ageFromBirthDate, isOnline, timeAgo } from "@/lib/utils";

export function ProfileHeader({ profile, isOwn, available, onToggleAvailable, onEdit }: { profile: Profile; isOwn: boolean; available: boolean; onToggleAvailable: () => void; onEdit: () => void }) {
  const online = isOnline(profile.last_seen);
  const age = ageFromBirthDate(profile.birth_date);
  const gender = profile.gender === "male" ? "👨 Мужчина" : profile.gender === "female" ? "👩 Женщина" : profile.gender === "couple_mf" ? "👫 Пара МЖ" : null;
  return (
    <header className="fixed left-4 right-4 top-[calc(5.5rem+env(safe-area-inset-top))] z-40 rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/20 via-accent-deep/10 to-gold/10 p-4 backdrop-blur-xl sm:p-5 md:left-64 md:right-0 md:top-24 md:mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-start gap-3 sm:gap-4">
        <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size="xl" lastSeen={profile.last_seen} showPresence />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold text-warm-100">{(profile.display_name ?? profile.username).slice(0, 10)}</h1>
            {(available || isOwn) && (isOwn ? (
              <button onClick={onToggleAvailable} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold ${available ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-gold/20 text-slate-400"}`}>
                {available ? <CheckCircle2 size={12} /> : <MessageSquare size={12} />}{available ? "Готов(а) общаться" : "Не готов(а) общаться"}
              </button>
            ) : <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[10px] font-semibold text-emerald-500"><CheckCircle2 size={12} />Готов(а) общаться</span>)}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">@{profile.username}</p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-400">{gender && <span>{gender}</span>}{profile.city && <span>{profile.city}</span>}{age && <span>{age} лет</span>}<span>{online ? "● В сети" : `Был(а) ${timeAgo(profile.last_seen)}`}</span></div>
        </div>
        {isOwn && <Button variant="ghost" size="icon" onClick={onEdit} className="shrink-0"><Pencil size={16} /></Button>}
      </div>
    </header>
  );
}
