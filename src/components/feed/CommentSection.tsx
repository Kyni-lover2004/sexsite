"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, Heart, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Textarea } from "@/components/ui/Input";
import { timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { CommentWithAuthor } from "@/lib/data/comments";

export function CommentSection({
  topicId,
  initialComments,
  currentUserId,
}: {
  topicId: string;
  initialComments: CommentWithAuthor[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const supa = supabase as any;
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !currentUserId) return;
    setSending(true);

    const { data, error } = await supa
      .from("comments")
      .insert({
        topic_id: topicId,
        author_id: currentUserId,
        body: text.trim(),
        parent_id: replyTo,
      })
      .select("*, author:profiles!comments_author_id_fkey(id,username,display_name,avatar_url)")
      .single();

    setSending(false);
    if (error || !data) {
      console.error("Comment submit error:", error);
      return;
    }

    const author = Array.isArray(data.author) ? data.author[0] ?? null : data.author;
    setComments((prev) => [...prev, { ...data, author } as CommentWithAuthor]);
    setText("");
    setReplyTo(null);
    router.refresh();
  }

  // Group comments: top-level vs replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="mt-8">
      <h3 className="mb-4 font-display text-lg font-semibold text-white">
        Комментарии <span className="text-gold-soft">({comments.length})</span>
      </h3>

      {currentUserId && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-2">
          {replyTo && (
            <p className="text-xs text-slate-500">
              Ответ на комментарий{" "}
              <button
                onClick={() => setReplyTo(null)}
                className="ml-1 text-gold-soft hover:underline"
              >
                отменить
              </button>
            </p>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? "Написать ответ…" : "Добавить комментарий…"}
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !text.trim()}>
              <Send size={14} />
              {sending ? "…" : "Отправить"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {topLevel.map((comment, i) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            index={i}
            replies={replies(comment.id)}
            currentUserId={currentUserId}
            onReply={(id) => setReplyTo(id)}
          />
        ))}
        {topLevel.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-600">
            Пока нет комментариев. Будьте первым!
          </p>
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  index,
  replies,
  currentUserId,
  onReply,
}: {
  comment: CommentWithAuthor;
  index: number;
  replies: CommentWithAuthor[];
  currentUserId: string | null;
  onReply: (id: string) => void;
}) {
  const author = comment.author;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.04, 0.2),
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="space-y-3"
    >
      <GlassCard className="p-4">
        <div className="flex items-start gap-3">
          <Avatar
            src={author?.avatar_url}
            name={author?.display_name ?? author?.username}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-white">
                {author?.display_name ?? author?.username ?? "Аноним"}
              </span>
              <span className="text-xs text-slate-600">
                {timeAgo(comment.created_at)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{comment.body}</p>
            {currentUserId && (
              <button
                onClick={() => onReply(comment.id)}
                className="mt-2 text-xs text-slate-500 transition-colors hover:text-gold-soft"
              >
                Ответить
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {replies.length > 0 && (
        <div className="ml-8 space-y-3 border-l border-gold/15 pl-4">
          {replies.map((reply, i) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              index={i}
              replies={[]}
              currentUserId={currentUserId}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
