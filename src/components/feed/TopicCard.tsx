"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Heart, MessageCircle, Eye, Image } from "lucide-react";
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

/** A single discussion card with gradient accent line and animated entry. */
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
      <GlassCard interactive className="relative overflow-hidden p-5">
        {/* Gradient accent line on the left */}
        <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-accent via-accent-deep to-gold/60" />

        <div className="flex items-center gap-3">
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
        </div>

        <Link href={`/topic/${topic.id}`} className="group mt-4 block">
          <h3 className="font-display text-lg font-semibold text-white transition-colors group-hover:text-gradient">
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
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Image size={14} />
            {topic.media.length} {topic.media.length === 1 ? "вложение" : "вложения"}
          </div>
        )}

        <div className="mt-4 flex items-center gap-5 text-sm text-slate-500">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => onLike?.(topic.id)}
            className={`flex items-center gap-1.5 transition-all duration-200 hover:text-accent-soft ${
              topic.liked_by_me ? "text-accent-soft" : ""
            }`}
            aria-label="Нравится"
          >
            <Heart
              size={16}
              className={
                topic.liked_by_me
                  ? "fill-current drop-shadow-[0_0_6px_rgba(225,29,120,0.5)]"
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

        {/* Subtle shine overlay */}
        <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </GlassCard>
    </motion.article>
  );
}
