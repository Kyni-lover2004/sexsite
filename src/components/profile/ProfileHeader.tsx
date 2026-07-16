"use client";
import {
  CheckCircle2,
  MessageSquare,
  Pencil,
  Shield,
  Crown,
  EyeOff,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ReportProfileButton } from "@/components/profile/ReportProfileButton";
import type { Profile } from "@/lib/types";
import {
  ageFromBirthDate,
  canUseInvisible,
  isOnline,
  presenceLabel,
  publicLastSeen,
} from "@/lib/utils";

export function ProfileHeader({
  profile,
  isOwn,
  available,
  invisible,
  canToggleInvisible = false,
  friendsCount,
  onToggleAvailable,
  onToggleInvisible,
  onEdit,
  currentUserId = null,
  isAdminModerating = false,
  onAdminRemoveAvatar,
  avatarActionBusy = false,
}: {
  profile: Profile;
  isOwn: boolean;
  available: boolean;
  invisible: boolean;
  canToggleInvisible?: boolean;
  friendsCount: number;
  onToggleAvailable: () => void;
  onToggleInvisible?: () => void;
  onEdit: () => void;
  currentUserId?: string | null;
  /** Admin viewing another user — media moderation controls */
  isAdminModerating?: boolean;
  onAdminRemoveAvatar?: () => void;
  avatarActionBusy?: boolean;
}) {
  const showPresenceToViewer = isOwn || !invisible;
  const seen = publicLastSeen(profile.last_seen, invisible, isOwn);
  const online = isOnline(seen);
  const label = presenceLabel(profile.last_seen, invisible, isOwn);
  const age = ageFromBirthDate(profile.birth_date);
  const gender =
    profile.gender === "male"
      ? "👨 Мужчина"
      : profile.gender === "female"
        ? "👩 Женщина"
        : profile.gender === "couple_mf"
          ? "👫 Пара МЖ"
          : null;
  const isPremium =
    profile.premium_until && new Date(profile.premium_until) > new Date();
  const invisibleAllowed =
    canToggleInvisible ||
    canUseInvisible(profile.premium_until, profile.role);

  return (
    <header className="fixed left-4 right-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/20 via-accent-deep/10 to-gold/10 p-4 backdrop-blur-xl sm:p-5 md:left-64 md:right-0 md:top-14 md:mx-auto md:max-w-4xl md:px-8">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="relative shrink-0">
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name ?? profile.username}
            size="xl"
            lastSeen={seen}
            showPresence={showPresenceToViewer}
          />
          {isAdminModerating && profile.avatar_url && onAdminRemoveAvatar && (
            <button
              type="button"
              onClick={onAdminRemoveAvatar}
              disabled={avatarActionBusy}
              title="Удалить аватар"
              aria-label="Удалить аватар"
              className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full border border-red-400/40 bg-black/80 text-red-200 shadow-lg transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              {avatarActionBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold text-warm-100">
              {(profile.display_name ?? profile.username).slice(0, 10)}
            </h1>
            {profile.role === "admin" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                <Shield size={10} className="fill-current" />
                Админ
              </span>
            )}
            {isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold-soft shadow-glow-gold">
                <Crown size={10} className="fill-current" />
                Premium
              </span>
            )}
            {(available || isOwn) &&
              (isOwn ? (
                <button
                  onClick={onToggleAvailable}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold ${
                    available
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-gold/20 text-slate-400"
                  }`}
                >
                  {available ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <MessageSquare size={12} />
                  )}
                  {available ? "Готов(а) общаться" : "Не готов(а) общаться"}
                </button>
              ) : (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[10px] font-semibold text-emerald-500">
                  <CheckCircle2 size={12} />
                  Готов(а) общаться
                </span>
              ))}
            {isOwn && invisibleAllowed && onToggleInvisible && (
              <button
                type="button"
                onClick={onToggleInvisible}
                title={
                  invisible
                    ? "Невидимка включена: вас не видно в сети и без «был(а)»"
                    : "Включить невидимку: скрыть онлайн и дату последнего визита"
                }
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-colors ${
                  invisible
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-300"
                    : "border-gold/20 text-slate-400 hover:border-violet-400/30 hover:text-violet-300"
                }`}
              >
                {invisible ? <EyeOff size={12} /> : <Eye size={12} />}
                {invisible ? "Невидимка" : "Видимый"}
              </button>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            @{profile.username}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-slate-400">
            {gender && <span>{gender}</span>}
            {profile.city && <span>{profile.city}</span>}
            {age && <span>{age} лет</span>}
            {label && (
              <span>
                {online ? `● ${label}` : label}
                {isOwn && invisible && (
                  <span className="ml-1 text-violet-300/80">(скрыто)</span>
                )}
              </span>
            )}
            <span>Друзей: {friendsCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isOwn ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="shrink-0"
            >
              <Pencil size={16} />
            </Button>
          ) : (
            <ReportProfileButton
              reportedUserId={profile.id}
              currentUserId={currentUserId}
              compact
            />
          )}
        </div>
      </div>
    </header>
  );
}
