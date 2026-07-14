"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2, MessageSquare, Send } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { SupportTicketWithMessages } from "@/lib/types";

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
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

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

    const { error: messageError } = await (supabase as any)
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: currentUserId,
        is_admin: false,
        body: body.trim(),
      });

    if (messageError) {
      setError(messageError.message);
      setLoading(null);
      return;
    }

    setSubject("");
    setBody("");
    setLoading(null);
    router.refresh();
  }

  async function sendReply(ticketId: string) {
    const draft = replyDrafts[ticketId]?.trim();
    if (!draft) return;

    setLoading(ticketId);
    setError("");

    const { error: messageError } = await (supabase as any)
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: currentUserId,
        is_admin: false,
        body: draft,
      });

    if (messageError) {
      setError(messageError.message);
      setLoading(null);
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
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
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading === "new" || !subject.trim() || !body.trim()}
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
                    <p className="mt-1 text-[10px] text-slate-500">
                      {message.is_admin ? "Администратор" : "Вы"} ·{" "}
                      {timeAgo(message.created_at)}
                    </p>
                  </div>
                ))}
              </div>

              {ticket.status !== "closed" && (
                <div className="mt-4 flex gap-2">
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
                    disabled={loading === ticket.id || !replyDrafts[ticket.id]?.trim()}
                  >
                    {loading === ticket.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </Button>
                </div>
              )}
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
