"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Heart, Eye, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CommentSection } from "./CommentSection";
import type { TopicWithAuthor, TopicMedia } from "@/lib/types";
import type { CommentWithAuthor } from "@/lib/data/comments";

export function TopicDetail({
  topic,
  initialComments,
  currentUserId,
}: {
  topic: TopicWithAuthor;
  initialComments: CommentWithAuthor[];
  currentUserId: string | null;
}) {
  const author = topic.author;

  return (
    <div>
      <Link
        href="/"
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к обсуждениям
      </Link>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard premium className="relative overflow-hidden p-6">
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
            <div>
              <p className="text-sm font-medium text-white">
                {author?.display_name ?? author?.username ?? "Аноним"}
              </p>
              <p className="text-xs text-slate-500">
                @{author?.username} · {timeAgo(topic.created_at)}
              </p>
            </div>
          </div>

          <h1 className="mt-4 font-display text-2xl font-bold text-gradient">
            {topic.title}
          </h1>

          {topic.body && (
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {topic.body}
            </div>
          )}

          {topic.media && topic.media.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {topic.media.map((m, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-white/[0.06]">
                  {m.type === "video" ? (
                    <video
                      src={m.url}
                      controls
                      className="max-h-96 w-full object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt=""
                      className="max-h-96 w-full cursor-pointer object-contain transition-opacity hover:opacity-90"
                      onClick={() => window.open(m.url, "_blank")}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {topic.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {topic.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center gap-5 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Heart size={16} />
              {topic.like_count}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={16} />
              {topic.comment_count}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye size={16} />
              {topic.view_count}
            </span>
          </div>
        </GlassCard>

        <CommentSection
          topicId={topic.id}
          initialComments={initialComments}
          currentUserId={currentUserId}
        />
      </motion.article>
    </div>
  );
}
