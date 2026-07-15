"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Send,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  X,
  Eye,
  Save,
  Pin,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tag } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TopicMedia } from "@/lib/types";

const DRAFT_KEY = "desire-prive-topic-draft-v1";

type DraftShape = {
  title: string;
  body: string;
  tags: string;
  topicType: "discussion" | "promo" | "news";
  pin: boolean;
  updatedAt: number;
};

export function CreateTopicForm({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [topicType, setTopicType] = useState<"discussion" | "promo" | "news">(
    "discussion"
  );
  const [pin, setPin] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [media, setMedia] = useState<
    { file: File; preview: string; uploading: boolean }[]
  >([]);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftShape;
      if (d.title) setTitle(d.title);
      if (d.body) setBody(d.body);
      if (d.tags) setTags(d.tags);
      if (d.topicType) setTopicType(d.topicType);
      if (typeof d.pin === "boolean") setPin(d.pin);
      if (d.updatedAt) setDraftSavedAt(d.updatedAt);
    } catch {
      /* ignore */
    }
  }, []);

  // Autosave draft (text only — files not persisted)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!title.trim() && !body.trim() && !tags.trim()) {
        localStorage.removeItem(DRAFT_KEY);
        setDraftSavedAt(null);
        return;
      }
      const payload: DraftShape = {
        title,
        body,
        tags,
        topicType,
        pin,
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setDraftSavedAt(payload.updatedAt);
    }, 600);
    return () => window.clearTimeout(t);
  }, [title, body, tags, topicType, pin]);

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      setMedia((prev) => [...prev, { file, preview: previewUrl, uploading: false }]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeMedia(i: number) {
    const item = media[i];
    URL.revokeObjectURL(item.preview);
    setMedia((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setDraftSavedAt(null);
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

    const safeType = isAdmin ? topicType : "discussion";
    const insertPayload: Record<string, unknown> = {
      author_id: user.id,
      title: title.trim(),
      body: body.trim(),
      tags: tagsList,
      media: uploadedMedia.length > 0 ? uploadedMedia : [],
      type: safeType,
    };
    if (isAdmin && pin) insertPayload.is_pinned = true;

    const { data, error: insertError } = await supa
      .from("topics")
      .insert(insertPayload)
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    media.forEach((m) => URL.revokeObjectURL(m.preview));
    clearDraft();

    if (data) {
      router.push(`/topic/${data.id}`);
      router.refresh();
    }
  }

  const tagsList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div>
      <Link
        href="/"
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
        Назад
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard premium className="p-6">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Sparkles size={18} className="text-gold-soft" />
            <h1 className="font-display text-xl font-bold text-gradient">
              Новая тема
            </h1>
            <div className="ml-auto flex items-center gap-2">
              {draftSavedAt && (
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Save size={12} />
                  черновик сохранён
                </span>
              )}
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  preview
                    ? "border-gold/35 bg-gold/15 text-gold-soft"
                    : "border-gold/15 text-slate-400 hover:border-gold/30"
                )}
              >
                <Eye size={14} />
                {preview ? "Редактор" : "Превью"}
              </button>
            </div>
          </div>
          <p className="mb-6 text-sm text-slate-500">
            Черновик сохраняется в браузере. Активная тема — одна; предыдущая
            уйдёт в архив.
          </p>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {preview ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-gold/15 bg-base-900/50 p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Как увидят в ленте
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-warm-100">
                  {title.trim() || "Без заголовка"}
                </h2>
                {body.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {body}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Нет описания</p>
                )}
                {tagsList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tagsList.map((t) => (
                      <Tag key={t} label={t} />
                    ))}
                  </div>
                )}
                {media.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {media.map((m, i) => (
                      <div
                        key={i}
                        className="h-20 w-20 overflow-hidden rounded-lg border border-gold/10"
                      >
                        {m.file.type.startsWith("video/") ? (
                          <video
                            src={m.preview}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.preview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreview(false)}
                >
                  К редактору
                </Button>
                <Button
                  type="button"
                  disabled={saving || !title.trim()}
                  onClick={() =>
                    void handleSubmit({
                      preventDefault() {},
                    } as React.FormEvent)
                  }
                >
                  <Send size={16} />
                  {saving ? "Публикация…" : "Опубликовать"}
                </Button>
              </div>
            </div>
          ) : (
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
                    <div
                      key={i}
                      className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/[0.08]"
                    >
                      {item.file.type.startsWith("video/") ? (
                        <video
                          src={item.preview}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
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
                  placeholder="знакомства, общение, город"
                />
              </div>

              {isAdmin && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-400">
                      Тип публикации
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["discussion", "news", "promo"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTopicType(t)}
                          className={cn(
                            "rounded-xl border px-3.5 py-2 text-xs font-medium transition-all duration-200",
                            topicType === t
                              ? "border-gold/30 bg-gold-gradient text-white shadow-glow-gold"
                              : "border-gold/15 bg-base-900/60 text-slate-400 hover:border-gold/30 hover:text-white"
                          )}
                        >
                          {t === "discussion" && "Обсуждение"}
                          {t === "news" && "Новость"}
                          {t === "promo" && "Реклама / Промо"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={pin}
                      onChange={(e) => setPin(e.target.checked)}
                      className="rounded border-gold/30 accent-amber-500"
                    />
                    <Pin size={14} className="text-gold-soft" />
                    Закрепить в ленте (новости / правила)
                  </label>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                {(title || body || tags) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTitle("");
                      setBody("");
                      setTags("");
                      clearDraft();
                    }}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    Очистить черновик
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreview(true)}
                    disabled={!title.trim()}
                  >
                    <Eye size={16} />
                    Превью
                  </Button>
                  <Button type="submit" disabled={saving || !title.trim()}>
                    <Send size={16} />
                    {saving ? "Публикация…" : "Опубликовать"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
