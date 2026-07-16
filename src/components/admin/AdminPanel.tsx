"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Crown,
  Flag,
  Headphones,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Shield,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { AttachmentGallery, AttachmentPicker } from "@/components/support/SupportAttachments";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, cn } from "@/lib/utils";
import type {
  Profile,
  SupportAttachment,
  SupportTicketWithMessages,
  TopicWithAuthor,
} from "@/lib/types";

type Tab =
  | "users"
  | "topics"
  | "support"
  | "chats"
  | "reports_posts"
  | "reports_people";
type BanDuration = "30d" | "90d" | "365d" | "permanent";
type PremiumDuration = "7d" | "30d" | "90d" | "365d" | "permanent";

export type ContentReportRow = {
  id: string;
  reporter_id: string;
  topic_id: string | null;
  comment_id: string | null;
  reason: string;
  reason_code?: string | null;
  details?: string | null;
  status: string;
  created_at: string;
  reporter?: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url"
  > | null;
  topic?: {
    id: string;
    title: string;
    author_id: string;
    body?: string | null;
  } | null;
  comment?: {
    id: string;
    body: string;
    topic_id: string;
    topic?: { id: string; title: string } | null;
  } | null;
};

export type ProfileReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason_code: string;
  reason_label: string;
  details: string;
  status: string;
  created_at: string;
  reporter?: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url"
  > | null;
  reported?: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url"
  > | null;
};

interface AdminPanelProps {
  currentUserId: string;
  /** Only site owner can demote other admins */
  isSiteOwner?: boolean;
  users: Profile[];
  topics: TopicWithAuthor[];
  supportTickets: SupportTicketWithMessages[];
  conversations: any[];
  contentReports?: ContentReportRow[];
  profileReports?: ProfileReportRow[];
}

const BAN_DURATIONS: { value: BanDuration; label: string }[] = [
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "365d", label: "1 год" },
  { value: "permanent", label: "Навсегда" },
];

const PREMIUM_DURATIONS: { value: PremiumDuration; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "365d", label: "1 год" },
  { value: "permanent", label: "Навсегда" },
];

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDate(value: string | null) {
  if (!value) return "без срока";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPremiumActive(user: Profile) {
  return !!user.premium_until && new Date(user.premium_until) > new Date();
}

export function AdminPanel({
  currentUserId,
  isSiteOwner = false,
  users,
  topics,
  supportTickets,
  conversations = [],
  contentReports: initialContentReports = [],
  profileReports: initialProfileReports = [],
}: AdminPanelProps) {
  const supabase = createClient();
  const supa = supabase as any;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [banUserId, setBanUserId] = useState<string | null>(null);
  const [premiumUserId, setPremiumUserId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("Нарушение правил сайта");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File[]>>({});
  const [contentReports, setContentReports] = useState(initialContentReports);
  const [profileReports, setProfileReports] = useState(initialProfileReports);

  async function setContentReportStatus(
    id: string,
    status: "open" | "reviewed" | "dismissed"
  ) {
    setActionLoading(id);
    const { error } = await supa
      .from("content_reports")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setContentReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
    setActionLoading(null);
  }

  async function setProfileReportStatus(
    id: string,
    status: "open" | "reviewed" | "dismissed"
  ) {
    setActionLoading(id);
    const { error } = await supa
      .from("profile_reports")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: currentUserId,
      })
      .eq("id", id);
    if (!error) {
      setProfileReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
    setActionLoading(null);
  }

  async function uploadSupportAttachments(
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

      const { error: uploadError } = await supa.storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supa.storage
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

  async function banUser(user: Profile, duration: BanDuration) {
    setActionLoading(user.id);
    const now = new Date();
    const bannedUntil =
      duration === "permanent"
        ? null
        : addDays(now, duration === "30d" ? 30 : duration === "90d" ? 90 : 365)
            .toISOString();

    const { error } = await supa
      .from("profiles")
      .update({
        is_banned: true,
        banned_until: bannedUntil,
        ban_reason: banReason.trim() || "Нарушение правил сайта",
        banned_by: currentUserId,
        banned_at: now.toISOString(),
      })
      .eq("id", user.id);

    if (error) alert(`Ошибка при бане: ${error.message}`);

    setActionLoading(null);
    setBanUserId(null);
    router.refresh();
  }

  async function unbanUser(userId: string) {
    setActionLoading(userId);
    const { error } = await supa
      .from("profiles")
      .update({
        is_banned: false,
        banned_until: null,
        ban_reason: null,
        banned_by: null,
        banned_at: null,
      })
      .eq("id", userId);

    if (error) alert(`Ошибка при разбане: ${error.message}`);

    setActionLoading(null);
    router.refresh();
  }

  async function grantPremium(user: Profile, duration: PremiumDuration) {
    setActionLoading(user.id);
    const currentExpiry =
      user.premium_until && new Date(user.premium_until) > new Date()
        ? new Date(user.premium_until)
        : new Date();
    const premiumUntil =
      duration === "permanent"
        ? addDays(new Date(), 36500).toISOString()
        : addDays(
            currentExpiry,
            duration === "7d"
              ? 7
              : duration === "30d"
                ? 30
                : duration === "90d"
                  ? 90
                  : 365
          ).toISOString();

    const { error } = await supa
      .from("profiles")
      .update({ premium_until: premiumUntil })
      .eq("id", user.id);

    if (error) alert(`Ошибка при выдаче премиума: ${error.message}`);

    setActionLoading(null);
    setPremiumUserId(null);
    router.refresh();
  }

  async function revokePremium(userId: string) {
    setActionLoading(userId);
    const { error } = await supa
      .from("profiles")
      .update({ premium_until: null })
      .eq("id", userId);

    if (error) alert(`Ошибка при снятии премиума: ${error.message}`);

    setActionLoading(null);
    router.refresh();
  }

  async function deleteUser(userId: string) {
    const target = users.find((u) => u.id === userId);
    if (target?.is_owner) {
      alert("Нельзя удалить владельца сайта.");
      return;
    }
    if (
      !window.confirm(
        "Навсегда удалить профиль и связанные данные пользователя?"
      )
    ) {
      return;
    }

    setActionLoading(userId);
    const { error } = await supa.from("profiles").delete().eq("id", userId);
    if (error) alert(`Ошибка при удалении профиля: ${error.message}`);
    setActionLoading(null);
    router.refresh();
  }

  async function setRole(userId: string, role: "admin" | "user") {
    const target = users.find((u) => u.id === userId);
    if (role === "user") {
      if (!isSiteOwner) {
        alert("Снимать админку может только владелец сайта.");
        return;
      }
      if (target?.is_owner) {
        alert("Нельзя снять админку с владельца сайта.");
        return;
      }
    }
    if (target?.is_owner && role !== "admin") {
      alert("Нельзя снять админку с владельца сайта.");
      return;
    }

    setActionLoading(userId);
    const { error } = await supa
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("site owner") || msg.includes("owner")) {
        alert("Снимать админку может только владелец сайта.");
      } else {
        alert(`Ошибка смены роли: ${error.message}`);
      }
    }
    setActionLoading(null);
    router.refresh();
  }

  async function deleteTopic(topicId: string) {
    setActionLoading(topicId);
    await supa.from("topics").delete().match({ id: topicId });
    setActionLoading(null);
    setConfirmDelete(null);
    router.refresh();
  }

  async function deleteConversation(conversationId: string) {
    if (!confirm("Вы уверены, что хотите полностью удалить этот чат? Все зашифрованные сообщения участников будут стерты.")) return;
    setActionLoading(conversationId);
    const { error } = await supa.from("conversations").delete().match({ id: conversationId });
    if (error) alert(`Ошибка удаления чата: ${error.message}`);
    setActionLoading(null);
    setConfirmDelete(null);
    router.refresh();
  }

  async function replyToTicket(ticketId: string) {
    const draft = replyDrafts[ticketId]?.trim();
    const files = replyFiles[ticketId] ?? [];
    if (!draft && files.length === 0) return;

    setActionLoading(ticketId);
    let attachments: SupportAttachment[] = [];

    try {
      attachments = await uploadSupportAttachments(ticketId, files);
    } catch (err: any) {
      alert(
        `Не удалось прикрепить фото: ${err?.message ?? "проверьте bucket support-attachments."}`
      );
      setActionLoading(null);
      return;
    }

    const { error } = await supa.from("support_messages").insert({
      ticket_id: ticketId,
      sender_id: currentUserId,
      is_admin: true,
      body: draft,
      attachments,
    });

    if (error) alert(`Ошибка ответа: ${error.message}`);
    setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
    setReplyFiles((prev) => ({ ...prev, [ticketId]: [] }));
    setActionLoading(null);
    router.refresh();
  }

  async function setTicketStatus(
    ticketId: string,
    status: "open" | "answered" | "closed"
  ) {
    setActionLoading(ticketId);
    const { error } = await supa
      .from("support_tickets")
      .update({ status })
      .eq("id", ticketId);

    if (error) alert(`Ошибка смены статуса: ${error.message}`);
    setActionLoading(null);
    router.refresh();
  }

  const q = query.toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!q) return true;
    return (
      user.username.toLowerCase().includes(q) ||
      user.display_name?.toLowerCase().includes(q) ||
      user.id.toLowerCase().includes(q)
    );
  });

  const filteredTopics = topics.filter((topic) => {
    if (!q) return true;
    return (
      topic.title.toLowerCase().includes(q) ||
      topic.body?.toLowerCase().includes(q) ||
      topic.author?.username.toLowerCase().includes(q)
    );
  });

  const filteredTickets = supportTickets.filter((ticket) => {
    if (!q) return true;
    return (
      ticket.subject.toLowerCase().includes(q) ||
      ticket.user?.username.toLowerCase().includes(q) ||
      ticket.messages.some((message) => message.body.toLowerCase().includes(q))
    );
  });

  const filteredConversations = conversations.filter((c) => {
    if (!q) return true;
    return (
      c.user_a_profile?.username.toLowerCase().includes(q) ||
      c.user_a_profile?.display_name?.toLowerCase().includes(q) ||
      c.user_b_profile?.username.toLowerCase().includes(q) ||
      c.user_b_profile?.display_name?.toLowerCase().includes(q)
    );
  });

  const activeBans = users.filter(
    (user) =>
      user.is_banned &&
      (!user.banned_until || new Date(user.banned_until) > new Date())
  ).length;
  const premiumCount = users.filter(isPremiumActive).length;
  const openPostReports = contentReports.filter((r) => r.status === "open")
    .length;
  const openPeopleReports = profileReports.filter((r) => r.status === "open")
    .length;

  const filteredContentReports = contentReports.filter((r) => {
    if (!q) return true;
    return (
      r.reason.toLowerCase().includes(q) ||
      r.reporter?.username?.toLowerCase().includes(q) ||
      r.topic?.title?.toLowerCase().includes(q) ||
      (r.details ?? "").toLowerCase().includes(q)
    );
  });
  const filteredProfileReports = profileReports.filter((r) => {
    if (!q) return true;
    return (
      r.reason_label.toLowerCase().includes(q) ||
      r.details.toLowerCase().includes(q) ||
      r.reporter?.username?.toLowerCase().includes(q) ||
      r.reported?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-gradient shadow-glow-accent">
            <Shield size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-gradient">
              Админ-панель
            </h1>
            <p className="text-sm text-slate-500">
              Пользователи, жалобы, премиум, блокировки и поддержка
            </p>
          </div>
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Пользователей" value={users.length} />
        <StatCard label="Премиум" value={premiumCount} tone="gold" />
        <StatCard label="Забанено" value={activeBans} tone="red" />
        <StatCard label="Поддержка" value={supportTickets.length} />
        <StatCard label="Жалобы посты" value={openPostReports} tone="red" />
        <StatCard label="Жалобы люди" value={openPeopleReports} tone="red" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          <Users size={16} />
          Пользователи
        </TabButton>
        <TabButton active={tab === "topics"} onClick={() => setTab("topics")}>
          <MessageSquare size={16} />
          Топики
        </TabButton>
        <TabButton
          active={tab === "reports_posts"}
          onClick={() => setTab("reports_posts")}
        >
          <Flag size={16} />
          Жалобы: посты
          {openPostReports > 0 && (
            <span className="ml-1 rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
              {openPostReports}
            </span>
          )}
        </TabButton>
        <TabButton
          active={tab === "reports_people"}
          onClick={() => setTab("reports_people")}
        >
          <UserRound size={16} />
          Жалобы: люди
          {openPeopleReports > 0 && (
            <span className="ml-1 rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
              {openPeopleReports}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "support"} onClick={() => setTab("support")}>
          <Headphones size={16} />
          Поддержка
        </TabButton>
        <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
          <MessageSquare size={16} />
          Модерация чатов
        </TabButton>
      </div>

      <div className="relative mb-4">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по текущему разделу..."
          className="pl-10"
        />
      </div>

      <AnimatePresence mode="wait">
        {tab === "users" && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-2"
          >
            {filteredUsers.map((user) => (
              <GlassCard
                key={user.id}
                className={`p-4 ${
                  user.is_banned ? "border-red-500/20 bg-red-950/10" : ""
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="shrink-0">
                      <Avatar
                        src={user.avatar_url}
                        name={user.display_name ?? user.username}
                        size="md"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 max-w-full truncate font-medium text-white">
                          {user.display_name ?? user.username}
                        </p>
                        {user.is_owner ? (
                          <Badge icon={Shield} label="OWNER" />
                        ) : user.role === "admin" ? (
                          <Badge icon={Shield} label="ADMIN" />
                        ) : null}
                        {isPremiumActive(user) && (
                          <Badge icon={Crown} label="Premium" />
                        )}
                        {user.is_banned && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                            <Ban size={10} />
                            <span className="truncate">БАН до {formatDate(user.banned_until)}</span>
                          </span>
                        )}
                      </div>
                      <p className="break-words text-xs text-slate-500">
                        @{user.username} · {user.city ?? "город не указан"} ·{" "}
                        {timeAgo(user.created_at)}
                      </p>
                      {user.ban_reason && user.is_banned && (
                        <p className="mt-1 break-words text-xs text-red-300">
                          Причина: {user.ban_reason}
                        </p>
                      )}
                      {user.premium_until && (
                        <p className="mt-1 text-xs text-gold-soft/80">
                          Премиум до {formatDate(user.premium_until)}
                        </p>
                      )}
                    </div>
                  </div>

                  {user.id !== currentUserId && (
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                      {user.role === "admin" ? (
                        isSiteOwner && !user.is_owner ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full lg:w-auto"
                            onClick={() => setRole(user.id, "user")}
                            disabled={actionLoading === user.id}
                          >
                            Снять админа
                          </Button>
                        ) : null
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full lg:w-auto"
                          onClick={() => setRole(user.id, "admin")}
                          disabled={actionLoading === user.id}
                        >
                          Сделать админом
                        </Button>
                      )}
                      {!user.is_owner &&
                        (user.is_banned ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full lg:w-auto"
                            onClick={() => unbanUser(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            <CheckCircle2 size={14} />
                            Разбан
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            className="w-full lg:w-auto"
                            onClick={() =>
                              setBanUserId(banUserId === user.id ? null : user.id)
                            }
                            disabled={actionLoading === user.id}
                          >
                            <Ban size={14} />
                            Бан
                          </Button>
                        ))}
                      <Button
                        variant="gold"
                        size="sm"
                        className="w-full lg:w-auto"
                        onClick={() =>
                          setPremiumUserId(
                            premiumUserId === user.id ? null : user.id
                          )
                        }
                        disabled={actionLoading === user.id}
                      >
                        <Crown size={14} />
                        Выдать премиум
                      </Button>
                      {isPremiumActive(user) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full lg:w-auto"
                          onClick={() => revokePremium(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          Снять Premium
                        </Button>
                      )}
                      {!user.is_owner && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 lg:w-auto"
                          onClick={() => deleteUser(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          <Trash2 size={14} />
                          Удалить
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {banUserId === user.id && (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <Textarea
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      rows={2}
                      placeholder="Причина блокировки"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {BAN_DURATIONS.map((duration) => (
                        <Button
                          key={duration.value}
                          variant="danger"
                          size="sm"
                          onClick={() => banUser(user, duration.value)}
                          disabled={actionLoading === user.id}
                        >
                          {duration.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {premiumUserId === user.id && (
                  <div className="mt-4 rounded-xl border border-gold/20 bg-gold/10 p-3">
                    <p className="mb-2 text-xs text-gold-soft/80">
                      Срок добавляется к текущей активной подписке, если она уже есть.
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {PREMIUM_DURATIONS.map((duration) => (
                        <Button
                          key={duration.value}
                          variant="gold"
                          size="sm"
                          onClick={() => grantPremium(user, duration.value)}
                          disabled={actionLoading === user.id}
                        >
                          {duration.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </motion.div>
        )}

        {tab === "reports_posts" && (
          <motion.div
            key="reports_posts"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-2"
          >
            {filteredContentReports.length === 0 ? (
              <GlassCard className="p-8 text-center text-slate-400">
                Жалоб на посты/комментарии пока нет
              </GlassCard>
            ) : (
              filteredContentReports.map((r) => {
                const linkedTopicId =
                  r.topic_id ?? r.comment?.topic_id ?? r.comment?.topic?.id ?? null;
                const linkedTitle =
                  r.topic?.title ?? r.comment?.topic?.title ?? null;
                const detailsText = (r.details ?? "").trim();
                // reason already includes "label: details" when submitted — avoid double-printing
                const reasonLooksCombined =
                  detailsText.length > 0 &&
                  r.reason.toLowerCase().includes(detailsText.toLowerCase());

                return (
                  <GlassCard
                    key={r.id}
                    className={cn(
                      "overflow-hidden p-4",
                      r.status === "open" && "border-red-500/20"
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <StatusPill status={r.status} />
                            <span className="shrink-0 text-slate-500">
                              {timeAgo(r.created_at)}
                            </span>
                            <span className="rounded bg-base-800 px-1.5 py-0.5 text-slate-400">
                              {r.comment_id ? "комментарий" : "пост"}
                            </span>
                          </div>

                          <p className="break-words text-sm font-medium text-warm-100">
                            {r.reason}
                          </p>
                          {detailsText && !reasonLooksCombined && (
                            <p className="whitespace-pre-wrap break-words text-xs text-slate-400">
                              {detailsText}
                            </p>
                          )}

                          {r.topic?.body && (
                            <div className="rounded-xl border border-gold/10 bg-base-900/40 px-3 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                Текст поста
                              </p>
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs text-slate-300">
                                {r.topic.body}
                              </p>
                            </div>
                          )}
                          {r.comment?.body && (
                            <div className="rounded-xl border border-gold/10 bg-base-900/40 px-3 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                Текст комментария
                              </p>
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs text-slate-300">
                                {r.comment.body}
                              </p>
                            </div>
                          )}

                          <div className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                            <span className="break-words">
                              От: @
                              {r.reporter?.username ?? r.reporter_id.slice(0, 8)}
                            </span>
                            {linkedTopicId && (
                              <Link
                                href={`/topic/${linkedTopicId}`}
                                className="min-w-0 break-words text-gold-soft hover:underline"
                              >
                                {linkedTitle
                                  ? `Открыть: ${linkedTitle}`
                                  : "Открыть пост"}
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="grid w-full shrink-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end">
                          {linkedTopicId && (
                            <Link
                              href={`/topic/${linkedTopicId}`}
                              className="min-[380px]:col-span-2 sm:col-auto"
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                              >
                                К посту
                              </Button>
                            </Link>
                          )}
                          {r.status === "open" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                disabled={actionLoading === r.id}
                                onClick={() =>
                                  void setContentReportStatus(r.id, "reviewed")
                                }
                              >
                                <CheckCircle2 size={14} />
                                Проверено
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full sm:w-auto"
                                disabled={actionLoading === r.id}
                                onClick={() =>
                                  void setContentReportStatus(r.id, "dismissed")
                                }
                              >
                                Отклонить
                              </Button>
                            </>
                          )}
                          {r.status !== "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full sm:w-auto"
                              disabled={actionLoading === r.id}
                              onClick={() =>
                                void setContentReportStatus(r.id, "open")
                              }
                            >
                              Вернуть
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </motion.div>
        )}

        {tab === "reports_people" && (
          <motion.div
            key="reports_people"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-2"
          >
            {filteredProfileReports.length === 0 ? (
              <GlassCard className="p-8 text-center text-slate-400">
                Жалоб на пользователей пока нет
              </GlassCard>
            ) : (
              filteredProfileReports.map((r) => (
                <GlassCard
                  key={r.id}
                  className={cn(
                    "overflow-hidden p-4",
                    r.status === "open" && "border-red-500/20"
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="shrink-0">
                        <Avatar
                          src={r.reported?.avatar_url}
                          name={
                            r.reported?.display_name ??
                            r.reported?.username ??
                            "?"
                          }
                          size="md"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <StatusPill status={r.status} />
                          <span className="shrink-0 text-slate-500">
                            {timeAgo(r.created_at)}
                          </span>
                        </div>
                        <p className="break-words font-medium text-warm-100">
                          <Link
                            href={`/profile/${r.reported_user_id}`}
                            className="hover:text-gold-soft"
                          >
                            @
                            {r.reported?.username ??
                              r.reported_user_id.slice(0, 8)}
                          </Link>
                          {r.reported?.display_name && (
                            <span className="ml-1.5 font-normal text-slate-400">
                              · {r.reported.display_name}
                            </span>
                          )}
                        </p>
                        <p className="break-words text-sm text-gold-soft/90">
                          {r.reason_label}
                        </p>
                        {r.details?.trim() && (
                          <p className="whitespace-pre-wrap break-words text-xs text-slate-400">
                            {r.details}
                          </p>
                        )}
                        <p className="break-words text-xs text-slate-500">
                          Жалоба от @
                          {r.reporter?.username ?? r.reporter_id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="grid w-full shrink-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end">
                      <Link
                        href={`/profile/${r.reported_user_id}`}
                        className="min-[380px]:col-span-2 sm:col-auto"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                        >
                          Анкета
                        </Button>
                      </Link>
                      {r.status === "open" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={actionLoading === r.id}
                            onClick={() =>
                              void setProfileReportStatus(r.id, "reviewed")
                            }
                          >
                            <CheckCircle2 size={14} />
                            Проверено
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full sm:w-auto"
                            disabled={actionLoading === r.id}
                            onClick={() =>
                              void setProfileReportStatus(r.id, "dismissed")
                            }
                          >
                            Отклонить
                          </Button>
                        </>
                      )}
                      {r.status !== "open" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          disabled={actionLoading === r.id}
                          onClick={() =>
                            void setProfileReportStatus(r.id, "open")
                          }
                        >
                          Вернуть
                        </Button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </motion.div>
        )}

        {tab === "topics" && (
          <motion.div
            key="topics"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-2"
          >
            {filteredTopics.map((topic) => (
              <GlassCard key={topic.id} className="p-4">
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-white">{topic.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {topic.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Автор: @{topic.author?.username ?? "?"}</span>
                      <span>{topic.view_count} просмотров</span>
                      <span>{topic.like_count} лайков</span>
                      <span>{topic.comment_count} комментариев</span>
                      <span>{timeAgo(topic.created_at)}</span>
                    </div>
                  </div>
                  {confirmDelete === topic.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle size={12} />
                        Удалить?
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteTopic(topic.id)}
                        disabled={actionLoading === topic.id}
                      >
                        Да
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Нет
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(topic.id)}
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  )}
                </div>
              </GlassCard>
            ))}
          </motion.div>
        )}

        {tab === "support" && (
          <motion.div
            key="support"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-3"
          >
            {filteredTickets.length === 0 ? (
              <GlassCard className="p-8 text-center text-slate-400">
                Обращений пока нет
              </GlassCard>
            ) : (
              filteredTickets.map((ticket) => (
                <GlassCard key={ticket.id} className="p-5">
                  <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words font-display text-lg font-semibold text-warm-100">
                        {ticket.subject}
                      </h2>
                      <p className="text-xs text-slate-500">
                        @{ticket.user?.username ?? "unknown"} · обновлено{" "}
                        {timeAgo(ticket.updated_at)}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3 sm:flex sm:flex-wrap sm:justify-end">
                      <Button
                        variant={ticket.status === "open" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setTicketStatus(ticket.id, "open")}
                        disabled={actionLoading === ticket.id}
                      >
                        Открыто
                      </Button>
                      <Button
                        variant={ticket.status === "answered" ? "gold" : "outline"}
                        size="sm"
                        onClick={() => setTicketStatus(ticket.id, "answered")}
                        disabled={actionLoading === ticket.id}
                      >
                        Отвечено
                      </Button>
                      <Button
                        variant={ticket.status === "closed" ? "danger" : "outline"}
                        size="sm"
                        onClick={() => setTicketStatus(ticket.id, "closed")}
                        disabled={actionLoading === ticket.id}
                      >
                        Закрыто
                      </Button>
                    </div>
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
                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                        {message.attachments?.length > 0 && (
                          <AttachmentGallery attachments={message.attachments} />
                        )}
                        <p className="mt-1 text-[10px] text-slate-500">
                          {message.is_admin ? "Админ" : "Пользователь"} ·{" "}
                          {timeAgo(message.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex min-w-0 gap-2">
                      <Input
                        value={replyDrafts[ticket.id] ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.value,
                          }))
                        }
                        placeholder="Ответить пользователю"
                        className="min-w-0"
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => replyToTicket(ticket.id)}
                        disabled={
                          actionLoading === ticket.id ||
                          (!replyDrafts[ticket.id]?.trim() &&
                            (replyFiles[ticket.id] ?? []).length === 0)
                        }
                      >
                        {actionLoading === ticket.id ? (
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
                      inputId={`admin-support-files-${ticket.id}`}
                    />
                  </div>
                </GlassCard>
              ))
            )}
          </motion.div>
        )}

        {tab === "chats" && (
          <motion.div
            key="chats"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="space-y-3"
          >
            {filteredConversations.length === 0 ? (
              <GlassCard className="p-8 text-center text-slate-400">
                Активных чатов не найдено
              </GlassCard>
            ) : (
              filteredConversations.map((c) => (
                <GlassCard key={c.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {c.user_a_profile?.display_name ?? c.user_a_profile?.username ?? "unknown"}
                      </span>
                      <span className="text-xs text-slate-500">↔</span>
                      <span className="text-sm font-semibold text-white">
                        {c.user_b_profile?.display_name ?? c.user_b_profile?.username ?? "unknown"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      ID чата: {c.id} · Обновлен {new Date(c.updated_at).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {confirmDelete === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteConversation(c.id)}
                          disabled={actionLoading === c.id}
                        >
                          Да, удалить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(c.id)}
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    )}
                  </div>
                </GlassCard>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-red-500/15 text-red-300 border-red-500/25",
    reviewed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    dismissed: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };
  const labels: Record<string, string> = {
    open: "Открыта",
    reviewed: "Проверена",
    dismissed: "Отклонена",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        map[status] ?? map.open
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "gold" | "red";
}) {
  return (
    <GlassCard className="min-w-0 overflow-hidden p-3 sm:p-4">
      <p className="break-words text-[11px] leading-tight text-slate-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold sm:text-2xl ${
          tone === "gold"
            ? "text-gold-soft"
            : tone === "red"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </GlassCard>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all sm:gap-2 sm:px-4 ${
        active
          ? "bg-accent-gradient text-white shadow-glow-accent"
          : "bg-base-800/50 text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-soft">
      <Icon size={10} />
      {label}
    </span>
  );
}
