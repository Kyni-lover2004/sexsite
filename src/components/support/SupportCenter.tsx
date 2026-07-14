"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, ImagePlus, Loader2, MessageSquare, Send, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { SupportAttachment, SupportTicketWithMessages } from "@/lib/types";

interface SupportCenterProps {
  currentUserId: string;
  tickets: SupportTicketWithMessages[];
}

export function SupportCenter({ currentUserId, tickets }: SupportCenterProps) {
  const supabase = createClient();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function uploadAttachments(
    ticketId: string,
    files: File[]
  ): Promise<SupportAttachment[]> {
    const uploaded: SupportAttachment[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error("Можно прикреплять только изображения.");
      }

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${currentUserId}/${ticketId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await (supabase as any).storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = await (supabase as any).storage
        .from("support-attachments")
        .getPublicUrl(path);

      uploaded.push({
        url: urlData.publicUrl,
        path,
        name: file.name,
        type: file.type,
      });
    }

    return uploaded;
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || (!body.trim() && newFiles.length === 0)) return;

    setLoading("new");
    setError("");

    const { data: ticket, error: ticketError } = await (supabase as any)
      .from("support_tickets")
      .insert({
        user_id: currentUserId,
        subject: subject.trim(),
      })
      .select("*")
      .single();

    if (ticketError || !ticket) {
      setError(ticketError?.message ?? "Не удалось создать обращение.");
      setLoading(null);
      return;
    }

    let attachments: SupportAttachment[] = [];

    try {
      attachments = await uploadAttachments(ticket.id, newFiles);
    } catch (err: any) {
      setError(
        `Не удалось прикрепить фото: ${err?.message ?? "проверьте bucket support-attachments."}`
      );
      setLoading(null);
      return;
    }

    const { error: messageError } = await (supabase as any)
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: currentUserId,
        is_admin: false,
        body: body.trim(),
        attachments,
      });

    if (messageError) {
      setError(messageError.message);
      setLoading(null);
      return;
    }

    setSubject("");
    setBody("");
    setNewFiles([]);
    setLoading(null);
    router.refresh();
  }

  async function sendReply(ticketId: string) {
    const draft = replyDrafts[ticketId]?.trim();
    const files = replyFiles[ticketId] ?? [];
    if (!draft && files.length === 0) return;

    setLoading(ticketId);
    setError("");

    let attachments: SupportAttachment[] = [];

    try {
      attachments = await uploadAttachments(ticketId, files);
    } catch (err: any) {
      setError(
        `Не удалось прикрепить фото: ${err?.message ?? "проверьте bucket support-attachments."}`
      );
      setLoading(null);
      return;
    }

    const { error: messageError } = await (supabase as any)
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: currentUserId,
        is_admin: false,
        body: draft,
        attachments,
      });

    if (messageError) {
      setError(messageError.message);
      setLoading(null);
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
    setReplyFiles((prev) => ({ ...prev, [ticketId]: [] }));
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gradient">
          Поддержка
        </h1>
        <p className="text-sm text-slate-500">
          Напишите нам, и администратор ответит в этом разделе
        </p>
      </div>

      <GlassCard className="p-5">
        <form onSubmit={createTicket} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-warm-100">
            <Headphones size={16} className="text-gold-soft" />
            Новое обращение
          </div>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема обращения"
            maxLength={160}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Опишите проблему"
            rows={4}
            maxLength={4000}
          />
          <AttachmentPicker
            files={newFiles}
            onChange={setNewFiles}
            inputId="support-new-files"
          />
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              loading === "new" ||
              !subject.trim() ||
              (!body.trim() && newFiles.length === 0)
            }
          >
            {loading === "new" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Отправить
          </Button>
        </form>
      </GlassCard>

      <div className="space-y-3">
        {tickets.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-gold-soft" />
            <p className="text-sm text-slate-400">Обращений пока нет</p>
          </GlassCard>
        ) : (
          tickets.map((ticket) => (
            <GlassCard key={ticket.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-warm-100">
                    {ticket.subject}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {timeAgo(ticket.updated_at)}
                  </p>
                </div>
                <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] text-gold-soft">
                  {ticket.status === "open"
                    ? "Открыто"
                    : ticket.status === "answered"
                      ? "Есть ответ"
                      : "Закрыто"}
                </span>
              </div>

              <div className="space-y-2">
                {ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl border px-3 py-2 ${
                      message.is_admin
                        ? "border-gold/20 bg-gold/10 text-gold-soft"
                        : "border-white/10 bg-base-900/50 text-slate-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                    {message.attachments?.length > 0 && (
                      <AttachmentGallery attachments={message.attachments} />
                    )}
                    <p className="mt-1 text-[10px] text-slate-500">
                      {message.is_admin ? "Администратор" : "Вы"} ·{" "}
                      {timeAgo(message.created_at)}
                    </p>
                  </div>
                ))}
              </div>

              {ticket.status !== "closed" && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={replyDrafts[ticket.id] ?? ""}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [ticket.id]: e.target.value,
                        }))
                      }
                      placeholder="Дополнить обращение"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => sendReply(ticket.id)}
                      disabled={
                        loading === ticket.id ||
                        (!replyDrafts[ticket.id]?.trim() &&
                          (replyFiles[ticket.id] ?? []).length === 0)
                      }
                    >
                      {loading === ticket.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </Button>
                  </div>
                  <AttachmentPicker
                    files={replyFiles[ticket.id] ?? []}
                    onChange={(files) =>
                      setReplyFiles((prev) => ({ ...prev, [ticket.id]: files }))
                    }
                    inputId={`support-reply-files-${ticket.id}`}
                  />
                </div>
              )}
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}

function AttachmentPicker({
  files,
  onChange,
  inputId,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  inputId: string;
}) {
  return (
    <div className="space-y-2">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files ?? [])]);
          e.currentTarget.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gold/25 bg-base-900/60 px-3 text-xs font-medium text-gold-soft transition-colors hover:bg-gold/10"
      >
        <ImagePlus size={14} />
        Прикрепить фото
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-gold/15 bg-gold/10 px-2 py-1 text-[11px] text-gold-soft"
            >
              {file.name}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label="Убрать фото"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentGallery({
  attachments,
}: {
  attachments: SupportAttachment[];
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {attachments.map((attachment) => (
        <a
          key={attachment.path}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="group block overflow-hidden rounded-lg border border-gold/10 bg-base-950/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.name || "Фото обращения"}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}
