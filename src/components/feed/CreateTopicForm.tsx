"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Send, AlertCircle, Sparkles, Image as ImageIcon, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TopicMedia } from "@/lib/types";

export function CreateTopicForm() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topicType, setTopicType] = useState<"discussion" | "promo" | "news">("discussion");
  const [media, setMedia] = useState<{ file: File; preview: string; uploading: boolean }[]>([]);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Auth user checking role:", user);
      if (user) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        console.log("Profile check result:", { profile, error });
        if (profile?.role === "admin") {
          console.log("User is admin! Showing post type selector.");
          setIsAdmin(true);
        } else {
          console.log("User is not admin. Role is:", profile?.role);
        }
      }
    }
    checkRole();
  }, [supabase]);

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      setMedia((prev) => [...prev, { file, preview, uploading: false }]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeMedia(i: number) {
    const item = media[i];
    URL.revokeObjectURL(item.preview);
    setMedia((prev) => prev.filter((_, idx) => idx !== i));
  }

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

    const uploadedMedia: TopicMedia[] = [];
    for (const item of media) {
      try {
        const ext = item.file.name.split(".").pop() ?? "jpg";
        const isVideo = item.file.type.startsWith("video/");
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await (supabase as any).storage
          .from("topic-media")
          .upload(path, item.file, { contentType: item.file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = await (supabase as any).storage
          .from("topic-media")
          .getPublicUrl(path);

        uploadedMedia.push({
          type: isVideo ? "video" : "image",
          url: urlData.publicUrl,
        });
      } catch (err) {
        console.error("Media upload error:", err);
        setError("Ошибка загрузки медиа");
        setSaving(false);
        return;
      }
    }

    if (!isAdmin) {
      await supa
        .from("topics")
        .update({ status: "archived" })
        .eq("author_id", user.id)
        .eq("status", "active");
    }

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
        media: uploadedMedia.length > 0 ? uploadedMedia : [],
        type: topicType,
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    media.forEach((m) => URL.revokeObjectURL(m.preview));

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
            <Sparkles size={18} className="text-gold-soft" />
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
                Фото / Видео
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleMediaSelect}
              />
              <div className="flex flex-wrap gap-2">
                {media.map((item, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/[0.08]">
                    {item.file.type.startsWith("video/") ? (
                      <video src={item.preview} className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.preview} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gold/20 text-slate-500 transition-colors hover:border-gold/50 hover:text-gold-soft"
                >
                  <ImageIcon size={20} />
                </button>
              </div>
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

            {isAdmin && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">
                  Тип публикации (Только для администраторов)
                </label>
                <div className="flex gap-2">
                  {(["discussion", "news", "promo"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopicType(t)}
                      className={cn(
                        "px-3.5 py-2 text-xs rounded-xl border font-medium transition-all duration-200",
                        topicType === t
                          ? "bg-gold-gradient text-white border-gold/30 shadow-glow-gold"
                          : "bg-base-900/60 border-gold/15 text-slate-400 hover:border-gold/30 hover:text-white"
                      )}
                    >
                      {t === "discussion" && "Обсуждение"}
                      {t === "news" && "Новость"}
                      {t === "promo" && "Реклама / Промо"}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
