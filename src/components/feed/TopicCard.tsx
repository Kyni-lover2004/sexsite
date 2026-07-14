"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Crown, Eye, Heart, Image, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { timeAgo } from "@/lib/utils";
import type { TopicWithAuthor } from "@/lib/types";

interface TopicCardProps {
  topic: TopicWithAuthor;
  index: number;
  onLike?: (id: string) => void;
}

/** A single discussion card with premium gold accents and animated entry. */
export function TopicCard({ topic, index, onLike }: TopicCardProps) {
  const author = topic.author;
  return (
    <motion.article
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.06, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <GlassCard interactive className="group relative overflow-hidden p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-soft/55 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgb(var(--gold-glow)/0.035)_42%,transparent_58%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative flex items-center gap-3">
          <Avatar
            src={author?.avatar_url}
            name={author?.display_name ?? author?.username}
            lastSeen={author?.last_seen}
            showPresence
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
          <span className="ml-auto hidden items-center gap-1 rounded-full border border-gold/15 bg-gold/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-gold-soft/70 sm:flex">
            <Crown size={11} />
            live
          </span>
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
            {topic.tags.slice(0, 5).map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        )}

        {topic.media && topic.media.length > 0 && (
          <div className="relative mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Image size={14} />
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
        </div>
        <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </GlassCard>
    </motion.article>
  );
}
