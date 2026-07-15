"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Heart, Eye, MessageCircle, Pencil, X, Sparkles, Crown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { cn, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CommentSection } from "./CommentSection";
import type { TopicWithAuthor } from "@/lib/types";
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
  const supabase = createClient();
  const author = topic.author;

  const [topicData, setTopicData] = useState<TopicWithAuthor>(topic);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editBody, setEditBody] = useState(topic.body);
  const [editTags, setEditTags] = useState(topic.tags.join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setSaving(true);
    const parsedTags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("topics")
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        tags: parsedTags,
      })
      .eq("id", topic.id);

    if (error) {
      alert(`Не удалось сохранить: ${error.message}`);
      setSaving(false);
      return;
    }

    setTopicData((prev) => ({
      ...prev,
      title: editTitle.trim(),
      body: editBody.trim(),
      tags: parsedTags,
    }));

    setSaving(false);
    setIsEditing(false);
  };

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
        <GlassCard
          premium
          className={cn(
            "relative overflow-hidden p-6",
            topicData.type === "news" && "border-rose-500/20 bg-rose-950/5",
            topicData.type === "promo" && "border-amber-500/20 bg-amber-950/5"
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-[2px]",
              topicData.type === "news" && "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]",
              topicData.type === "promo" && "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]",
              (topicData.type === "discussion" || !topicData.type) && "bg-gradient-to-b from-accent via-accent-deep to-gold/60"
            )}
          />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                src={author?.avatar_url}
                name={author?.display_name ?? author?.username}
                lastSeen={author?.last_seen}
                showPresence
                size="md"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white">
                    {author?.display_name ?? author?.username ?? "Аноним"}
                  </p>
                  {topicData.type === "news" && (
                    <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] font-semibold text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                      <Sparkles size={9} />
                      Новость
                    </span>
                  )}
                  {topicData.type === "promo" && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] font-semibold text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                      <Crown size={9} />
                      Промо
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  @{author?.username} · {timeAgo(topicData.created_at)}
                </p>
              </div>
            </div>

            {!isEditing && currentUserId === topicData.author_id && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-xl border border-gold/15 bg-base-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-gold/30 hover:text-white transition-all duration-300"
              >
                <Pencil size={13} />
                Редактировать
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Заголовок</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gold/15 bg-base-850 px-3.5 text-sm text-slate-100 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Текст обсуждения</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-gold/15 bg-base-850 p-3.5 text-sm text-slate-100 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15 resize-y"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">Теги (через запятую)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="например: секс, знакомства, общение"
                  className="h-10 w-full rounded-xl border border-gold/15 bg-base-850 px-3.5 text-sm text-slate-100 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditTitle(topicData.title);
                    setEditBody(topicData.body);
                    setEditTags(topicData.tags.join(", "));
                    setIsEditing(false);
                  }}
                  disabled={saving}
                >
                  <X size={14} />
                  Отмена
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-4 font-display text-2xl font-bold text-gradient">
                {topicData.title}
              </h1>

              {topicData.body && (
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {topicData.body}
                </div>
              )}

              {topicData.media && topicData.media.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {topicData.media.map((m, i) => (
                    <div key={i} className="overflow-hidden rounded-lg border border-white/[0.06]">
                      {m.type === "video" ? (
                        <video
                          src={m.url}
                          controls
                          className="max-h-96 w-full object-contain"
                        />
                      ) : (
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

              {topicData.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {topicData.tags.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </div>
              )}

              <div className="mt-5 flex items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Heart size={16} />
                  {topicData.like_count}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle size={16} />
                  {topicData.comment_count}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye size={16} />
                  {topicData.view_count}
                </span>
              </div>
            </>
          )}
        </GlassCard>

        <CommentSection
          topicId={topicData.id}
          initialComments={initialComments}
          currentUserId={currentUserId}
        />
      </motion.article>
    </div>
  );
}
