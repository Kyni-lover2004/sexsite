"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Crown, Eye, Heart, Image as ImageIcon, MessageCircle, Pin, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { ReportButton } from "@/components/feed/ReportButton";
import { cn, timeAgo } from "@/lib/utils";
import type { TopicWithAuthor } from "@/lib/types";

interface TopicCardProps {
  topic: TopicWithAuthor;
  index: number;
  onLike?: (id: string) => void;
  currentUserId?: string | null;
  onTagClick?: (tag: string) => void;
}

/** A single discussion card with premium gold accents and animated entry. */
export function TopicCard({
  topic,
  index,
  onLike,
  currentUserId,
  onTagClick,
}: TopicCardProps) {
  const author = topic.author;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.03, 0.15),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <GlassCard
        interactive
        className={cn(
          "group relative overflow-hidden p-5",
          topic.is_pinned && "border-gold/30 bg-gold/[0.04] ring-1 ring-gold/15",
          topic.type === "news" && "border-rose-500/20 bg-rose-950/5",
          topic.type === "promo" && "border-amber-500/20 bg-amber-950/5"
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
            topic.type === "news" && "via-rose-500/50",
            topic.type === "promo" && "via-amber-500/50",
            (topic.type === "discussion" || !topic.type) && "via-gold-soft/55"
          )}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgb(var(--gold-glow)/0.035)_42%,transparent_58%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative flex items-center gap-3">
          <Avatar
            src={author?.avatar_url}
            name={author?.display_name ?? author?.username}
            lastSeen={author?.is_invisible ? null : author?.last_seen}
            showPresence={!author?.is_invisible}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {author?.display_name ?? author?.username ?? "Аноним"}
            </p>
            <p className="text-xs text-slate-500">
              @{author?.username ?? "unknown"} · {timeAgo(topic.created_at)}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
            {topic.is_pinned && (
              <span className="badge-premium px-2 py-1 text-[10px] uppercase tracking-[0.14em]">
                <Pin size={11} />
                Закреп
              </span>
            )}
            {topic.type === "news" && (
              <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-400">
                <Sparkles size={11} />
                Новость
              </span>
            )}
            {topic.type === "promo" && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">
                <Crown size={11} />
                Промо
              </span>
            )}
          </div>
        </div>

        <Link href={`/topic/${topic.id}`} className="relative mt-4 block">
          <h3 className="font-display text-lg font-semibold text-warm-100 transition-colors hover:text-gold-soft">
            {topic.title}
          </h3>
          {topic.body && (
            <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
              {topic.body}
            </p>
          )}
        </Link>

        {topic.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topic.tags.slice(0, 5).map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  className="transition-opacity hover:opacity-80"
                >
                  <Tag label={tag} />
                </button>
              ) : (
                <Tag key={tag} label={tag} />
              )
            )}
          </div>
        )}

        {topic.media && topic.media.length > 0 && (
          <div className="relative mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <ImageIcon size={14} />
            {topic.media.length} {topic.media.length === 1 ? "вложение" : "вложения"}
          </div>
        )}

        <div className="relative mt-4 flex items-center gap-5 border-t border-gold/10 pt-4 text-sm text-slate-500">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => onLike?.(topic.id)}
            className={`flex items-center gap-1.5 transition-all duration-200 hover:text-gold-soft ${
              topic.liked_by_me ? "text-gold-soft" : ""
            }`}
            aria-label="Нравится"
          >
            <Heart
              size={16}
              className={
                topic.liked_by_me
                  ? "fill-current drop-shadow-[0_0_7px_rgb(var(--gold-glow)/0.5)]"
                  : ""
              }
            />
            {topic.like_count}
          </motion.button>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={16} />
            {topic.comment_count}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={16} />
            {topic.view_count}
          </span>
          <span className="ml-auto">
            <ReportButton
              topicId={topic.id}
              currentUserId={currentUserId ?? null}
              compact
            />
          </span>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </GlassCard>
    </motion.article>
  );
}
