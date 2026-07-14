"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Users,
  MessageSquare,
  Ban,
  CheckCircle2,
  Trash2,
  Search,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { Profile, TopicWithAuthor } from "@/lib/types";

type Tab = "users" | "topics";

interface AdminPanelProps {
  currentUserId: string;
  users: Profile[];
  topics: TopicWithAuthor[];
}

export function AdminPanel({ currentUserId, users, topics }: AdminPanelProps) {
  const supabase = createClient();
  const supa = supabase as any;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [banOptionsUserId, setBanOptionsUserId] = useState<string | null>(null);

  /* ───── User actions ───── */

  async function banUser(userId: string, duration: "30m" | "1d" | "3d" | "permanent") {
    setActionLoading(userId);
    let banned_until: string | null = null;
    const now = new Date();
    
    if (duration === "30m") {
      banned_until = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    } else if (duration === "1d") {
      banned_until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (duration === "3d") {
      banned_until = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supa
      .from("profiles")
      .update({ is_banned: true, banned_until })
      .eq("id", userId);

    if (error) {
      alert(`Ошибка при бане: ${error.message}`);
    }

    setActionLoading(null);
    setBanOptionsUserId(null);
    router.refresh();
  }

  async function unbanUser(userId: string) {
    setActionLoading(userId);
    const { error } = await supa
      .from("profiles")
      .update({ is_banned: false, banned_until: null })
      .eq("id", userId);

    if (error) {
      alert(`Ошибка при разбане: ${error.message}`);
    }

    setActionLoading(null);
    router.refresh();
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("Вы уверены, что хотите НАВСЕГДА удалить этот профиль? Все топики, сообщения, комментарии, фото и ключи шифрования пользователя будут безвозвратно удалены из базы данных.")) {
      return;
    }
    setActionLoading(userId);
    const { error } = await supa
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (error) {
      alert(`Ошибка при удалении профиля: ${error.message}`);
    }
    setActionLoading(null);
    router.refresh();
  }

  async function setRole(userId: string, role: "admin" | "user") {
    setActionLoading(userId);
    await supa
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    setActionLoading(null);
    router.refresh();
  }

  /* ───── Topic actions ───── */

  async function deleteTopic(topicId: string) {
    setActionLoading(topicId);
    await supa.from("topics").delete().match({ id: topicId });
    setActionLoading(null);
    setConfirmDelete(null);
    router.refresh();
  }

  /* ───── Filtering ───── */

  const q = query.toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const filteredTopics = topics.filter((t) => {
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.body?.toLowerCase().includes(q) ||
      t.author?.username.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-gradient shadow-glow-accent">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-gradient">
              Админ-панель
            </h1>
            <p className="text-sm text-slate-500">
              Управление пользователями и контентом
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-500">Пользователей</p>
          <p className="mt-1 font-display text-2xl font-bold text-white">
            {users.length}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-slate-500">Топиков</p>
          <p className="mt-1 font-display text-2xl font-bold text-white">
            {topics.length}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-slate-500">Забанено</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-400">
            {users.filter((u) => u.is_banned).length}
          </p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "users"
              ? "bg-accent-gradient text-white shadow-glow-accent"
              : "bg-base-800/50 text-slate-400 hover:text-white"
          }`}
        >
          <Users size={16} />
          Пользователи
        </button>
        <button
          onClick={() => setTab("topics")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === "topics"
              ? "bg-accent-gradient text-white shadow-glow-accent"
              : "bg-base-800/50 text-slate-400 hover:text-white"
          }`}
        >
          <MessageSquare size={16} />
          Топики
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "users"
              ? "Поиск по имени, username или ID…"
              : "Поиск по заголовку или автору…"
          }
          className="pl-10"
        />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "users" ? (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-2"
          >
            {filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-slate-500">
                Пользователи не найдены
              </p>
            ) : (
              filteredUsers.map((user) => (
                <GlassCard
                  key={user.id}
                  className={`p-4 ${
                    user.is_banned
                      ? "border-red-500/20 bg-red-950/10"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatar_url}
                      name={user.display_name ?? user.username}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">
                          {user.display_name ?? user.username}
                        </p>
                        {user.role === "admin" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-soft">
                            <Crown size={10} />
                            ADMIN
                          </span>
                        )}
                        {user.is_banned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            <Ban size={10} />
                            ЗАБАНЕН {user.banned_until ? `до ${new Date(user.banned_until).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "навсегда"}
                          </span>
                        )}
                        {user.premium_until &&
                          new Date(user.premium_until) > new Date() && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gradient-gold">
                              <Crown size={10} className="text-gold-soft" />
                              PRO
                            </span>
                          )}
                      </div>
                      <p className="text-xs text-slate-500">
                        @{user.username} · {user.gender} ·{" "}
                        {user.city ?? "город не указан"} · рег.{" "}
                        {timeAgo(user.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    {user.id !== currentUserId && (
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {banOptionsUserId === user.id ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] text-slate-400 mr-1">Срок:</span>
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => banUser(user.id, "30m")}
                              disabled={actionLoading === user.id}
                            >
                              30м
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => banUser(user.id, "1d")}
                              disabled={actionLoading === user.id}
                            >
                              1д
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => banUser(user.id, "3d")}
                              disabled={actionLoading === user.id}
                            >
                              3д
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => banUser(user.id, "permanent")}
                              disabled={actionLoading === user.id}
                            >
                              Навсегда
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setBanOptionsUserId(null)}
                            >
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {user.is_banned ? (
                              <Button
                                variant="primary"
                                size="sm"
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
                                onClick={() => setBanOptionsUserId(user.id)}
                                disabled={actionLoading === user.id}
                              >
                                <Ban size={14} />
                                Бан
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                              onClick={() => deleteUser(user.id)}
                              disabled={actionLoading === user.id}
                            >
                              <Trash2 size={14} />
                              Удалить
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="topics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-2"
          >
            {filteredTopics.length === 0 ? (
              <p className="py-8 text-center text-slate-500">
                Топики не найдены
              </p>
            ) : (
              filteredTopics.map((topic) => (
                <GlassCard key={topic.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{topic.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {topic.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>
                          Автор: @
                          {topic.author?.username ?? "?"}
                        </span>
                        <span>👁 {topic.view_count}</span>
                        <span>❤️ {topic.like_count}</span>
                        <span>💬 {topic.comment_count}</span>
                        <span>{timeAgo(topic.created_at)}</span>
                      </div>
                    </div>

                    {/* Delete with confirmation */}
                    <div className="flex-shrink-0">
                      {confirmDelete === topic.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 flex items-center gap-1">
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
