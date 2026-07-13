"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Flame, Sparkles, PenLine } from "lucide-react";
import Link from "next/link";
import { TopicCard } from "./TopicCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { scoreTopic } from "@/lib/feed";
import type { FeedTab, TopicWithAuthor } from "@/lib/types";

interface FeedProps {
  initialTopics: TopicWithAuthor[];
  currentUserId: string | null;
}

/**
 * Discussion feed: "New" / "Popular" tabs, live search, optimistic likes.
 * Initial data is server-rendered; interactions happen client-side.
 */
export function Feed({ initialTopics, currentUserId }: FeedProps) {
  const supabase = createClient();
  const supa = supabase as any;
  const [topics, setTopics] = useState<TopicWithAuthor[]>(initialTopics);
  const [tab, setTab] = useState<FeedTab>("new");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Re-fetch when the tab changes (server does the base ordering).
  useEffect(() => {
    let active = true;
    setLoading(true);

    const order =
      tab === "new"
        ? { column: "created_at", ascending: false }
        : { column: "like_count", ascending: false };

    supa
      .from("topics")
      .select(
        "*, author:profiles!topics_author_id_fkey(id,username,display_name,avatar_url,last_seen)"
      )
      .eq("status", "active")
      .order(order.column, { ascending: order.ascending })
      .limit(50)
      .then(({ data }: { data: any }) => {
        if (!active) return;
        const rows = (data as TopicWithAuthor[] | null) ?? [];
        // "Popular" uses a time-decayed score computed client-side.
        const sorted =
          tab === "popular"
            ? [...rows].sort((a, b) => scoreTopic(b) - scoreTopic(a))
            : rows;
        setTopics(sorted);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tab]);

  // Live search filters the already-loaded list (title + tags).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [topics, query]);

  async function handleLike(id: string) {
    if (!currentUserId) return;
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    const liked = target.liked_by_me;

    // Optimistic update
    startTransition(() =>
      setTopics((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                liked_by_me: !liked,
                like_count: t.like_count + (liked ? -1 : 1),
              }
            : t
        )
      )
    );

    if (liked) {
      await supa
        .from("reactions")
        .delete()
        .match({ user_id: currentUserId, topic_id: id, emoji: "👍" });
    } else {
      await supa
        .from("reactions")
        .insert({ user_id: currentUserId, topic_id: id, emoji: "👍" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl font-bold text-gradient"
          >
            Обсуждения
          </motion.h1>
          <p className="text-sm text-slate-500">
            Тёплые дискуссии сообщества
          </p>
        </div>
        <Link href="/topic/new">
          <Button size="md">
            <PenLine size={16} />
            Создать тему
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по темам и тегам…"
          className="h-11 w-full rounded-xl border border-white/[0.08] bg-base-800/60 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 backdrop-blur transition-all duration-300 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:shadow-[0_0_20px_rgba(225,29,120,0.08)]"
        />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        <TabButton
          active={tab === "new"}
          onClick={() => setTab("new")}
          icon={<Sparkles size={15} />}
          label="Новые"
        />
        <TabButton
          active={tab === "popular"}
          onClick={() => setTab("popular")}
          icon={<Flame size={15} />}
          label="Популярные"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <TopicSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasQuery={query.length > 0} />
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {visible.map((topic, i) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                index={i}
                onLike={handleLike}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:text-white"
    >
      {active && (
        <motion.span
          layoutId="feed-tab"
          className="absolute inset-0 rounded-lg bg-accent-gradient shadow-glow-accent"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className={`relative z-10 flex items-center gap-2 ${active ? "text-white" : ""}`}>
        {icon}
        {label}
      </span>
    </button>
  );
}

function TopicSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-base-800/40 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-accent/10 grid place-items-center">
        <Sparkles size={20} className="text-accent-soft" />
      </div>
      <p className="text-slate-300">
        {hasQuery ? "Ничего не найдено" : "Пока нет активных тем"}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasQuery
          ? "Попробуйте другой запрос"
          : "Создайте первую и начните обсуждение"}
      </p>
    </div>
  );
}
