"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Flame, PenLine, Search, Sparkles } from "lucide-react";
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

export function Feed({ initialTopics, currentUserId }: FeedProps) {
  const supabase = useMemo(() => createClient(), []);
  const supa = supabase as any;
  const [topics, setTopics] = useState<TopicWithAuthor[]>(initialTopics);
  const [tab, setTab] = useState<FeedTab>("new");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const [, startTransition] = useTransition();
  // Skip the first "new" fetch — server already sent initialTopics.
  const skipInitialNewFetch = useRef(true);

  useEffect(() => {
    if (tab === "new" && skipInitialNewFetch.current) {
      skipInitialNewFetch.current = false;
      return;
    }

    let active = true;
    setLoading(true);

    const order =
      tab === "new"
        ? { column: "created_at", ascending: false }
        : { column: "like_count", ascending: false };

    supa
      .from("topics")
      .select(
        "id, author_id, title, body, tags, media, status, view_count, like_count, comment_count, type, created_at, updated_at, author:profiles!topics_author_id_fkey(id,username,display_name,avatar_url,last_seen,premium_until)"
      )
      .eq("status", "active")
      .order(order.column, { ascending: order.ascending })
      .limit(50)
      .then(async ({ data }: { data: any }) => {
        if (!active) return;
        const rows = (data as TopicWithAuthor[] | null) ?? [];

        let likedTopicIds = new Set<string>();
        if (currentUserId && rows.length > 0) {
          const { data: reactions } = await supa
            .from("reactions")
            .select("topic_id")
            .eq("user_id", currentUserId)
            .eq("emoji", "👍")
            .in(
              "topic_id",
              rows.map((r) => r.id)
            );

          if (reactions) {
            likedTopicIds = new Set(reactions.map((r: any) => r.topic_id));
          }
        }

        const mapped = rows.map((t) => ({
          ...t,
          liked_by_me: likedTopicIds.has(t.id),
        }));

        const sorted =
          tab === "popular"
            ? [...mapped].sort((a, b) => scoreTopic(b) - scoreTopic(a))
            : mapped;
        setTopics(sorted);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, supa, tab]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [topics, deferredQuery]);

  async function handleLike(id: string) {
    if (!currentUserId) return;
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    const liked = target.liked_by_me;

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
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative mb-7 overflow-hidden rounded-2xl border border-gold/15 bg-base-900/60 p-5 shadow-glass backdrop-blur-2xl md:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-soft/45 to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/[0.07] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-soft/75">
              <Crown size={13} />
              закрытое сообщество
            </div>
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display text-3xl font-bold leading-tight text-gradient sm:text-4xl md:text-5xl"
            >
              Обсуждения
            </motion.h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Тёплые дискуссии сообщества в приватной, спокойной атмосфере.
              Меньше шума, больше смысла.
            </p>
          </div>
          <Link href="/topic/new" className="shrink-0">
            <Button size="lg" className="w-full sm:w-auto">
              <PenLine size={16} />
              Создать тему
            </Button>
          </Link>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 border-t border-gold/10 pt-4">
          <Metric icon={<Sparkles size={14} />} label="Новые" value={topics.length} />
          <Metric icon={<Flame size={14} />} label="Горячие" value={visible.length} />
        </div>
      </div>

      <div className="relative mb-4">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по темам и тегам…"
          className="h-11 w-full rounded-xl border border-gold/15 bg-base-900/60 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 backdrop-blur transition-all duration-300 focus:border-gold/45 focus:outline-none focus:ring-2 focus:ring-gold/15 focus:shadow-[0_0_24px_rgb(var(--gold-glow)/0.1)]"
        />
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-gold/15 bg-base-900/60 p-1 shadow-inner-glow">
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
      className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:text-warm-100"
    >
      {active && (
        <motion.span
          layoutId="feed-tab"
          className="absolute inset-0 rounded-lg border border-gold/20 bg-accent-gradient shadow-glow-accent"
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
    <div className="rounded-2xl border border-gold/10 bg-base-800/45 p-5">
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
    <div className="rounded-2xl border border-dashed border-gold/15 bg-base-900/35 p-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-gold/20 bg-gold/10">
        <Sparkles size={20} className="text-gold-soft" />
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

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
        <span className="text-gold-soft/70">{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold text-warm-100">
        {value}
      </div>
    </div>
  );
}
