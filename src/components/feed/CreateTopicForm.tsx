"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Send, AlertCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";

export function CreateTopicForm() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Необходимо войти");
      setSaving(false);
      return;
    }

    const supa = supabase as any;

    // Archive any existing active topic
    await supa
      .from("topics")
      .update({ status: "archived" })
      .eq("author_id", user.id)
      .eq("status", "active");

    // Create the new topic
    const tagsList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { data, error: insertError } = await supa
      .from("topics")
      .insert({
        author_id: user.id,
        title: title.trim(),
        body: body.trim(),
        tags: tagsList,
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data) {
      router.push(`/topic/${data.id}`);
      router.refresh();
    }
  }

  return (
    <div>
      <Link
        href="/"
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Назад
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard premium className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-accent-soft" />
            <h1 className="font-display text-xl font-bold text-gradient">
              Новая тема
            </h1>
          </div>
          <p className="mb-6 text-sm text-slate-500">
            Можно создать только 1 активную тему. Предыдущая будет отправлена в
            архив.
          </p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Заголовок *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="О чём хотите поговорить?"
                maxLength={160}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Описание
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Раскройте тему…"
                rows={5}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Теги (через запятую)
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="технологии, дизайн, жизнь"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving || !title.trim()}>
                <Send size={16} />
                {saving ? "Публикация…" : "Опубликовать"}
              </Button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
