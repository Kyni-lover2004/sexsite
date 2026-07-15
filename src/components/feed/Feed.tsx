"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Crown,
  Flame,
  Hash,
  Heart,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { TopicCard } from "./TopicCard";
import { PeopleStrip } from "./PeopleStrip";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { scoreTopic } from "@/lib/feed";
import { haptic } from "@/lib/haptic";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import type { FeedPerson, FeedTab, TopicWithAuthor } from "@/lib/types";

interface FeedProps {
  initialTopics: TopicWithAuthor[];
  initialPeople?: FeedPerson[];
  interestTags?: string[];
  currentUserId: string | null;
}

export function Feed({
  initialTopics,
  initialPeople = [],
  interestTags = [],
  currentUserId,
}: FeedProps) {
  const supabase = useMemo(() => createClient(), []);
  const supa = supabase as any;
  const [topics, setTopics] = useState<TopicWithAuthor[]>(initialTopics);
  const [people] = useState<FeedPerson[]>(initialPeople);
  const [tab, setTab] = useState<FeedTab>("new");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const [, startTransition] = useTransition();
  const skipInitialNewFetch = useRef(true);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of topics) {
      for (const tag of t.tags ?? []) {
        const k = tag.trim();
        if (!k) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    // Prefer viewer interests first, then hot tags
    const interestSet = new Set(interestTags.map((t) => t.toLowerCase()));
    return Array.from(counts.entries())
      .sort((a, b) => {
        const ai = interestSet.has(a[0].toLowerCase()) ? 1 : 0;
        const bi = interestSet.has(b[0].toLowerCase()) ? 1 : 0;
        if (bi !== ai) return bi - ai;
        return b[1] - a[1];
      })
      .map(([tag]) => tag)
      .slice(0, 16);
  }, [topics, interestTags]);

  useEffect(() => {
    if (tab === "new" && skipInitialNewFetch.current && !tagFilter) {
      skipInitialNewFetch.current = false;
      return;
    }

    let active = true;
    setLoading(true);

    let query = supa
      .from("topics")
      .select(
        "id, author_id, title, body, tags, media, status, view_count, like_count, comment_count, type, is_pinned, created_at, updated_at, author:profiles!topics_author_id_fkey(id,username,display_name,avatar_url,last_seen,premium_until)"
      )
      .eq("status", "active")
      .order("is_pinned", { ascending: false })
      .limit(50);

    if (tab === "popular") {
      query = query
        .order("like_count", { ascending: false })
        .order("comment_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (tagFilter) {
      query = query.contains("tags", [tagFilter]);
    }

    if (tab === "interests" && interestTags.length > 0) {
      query = query.overlaps("tags", interestTags.slice(0, 12));
    }

    query
      .then(async ({ data, error }: { data: any; error: any }) => {
        if (!active) return;
        if (error) {
          // Pre-migration without is_pinned
          const fallback = await supa
            .from("topics")
            .select(
              "id, author_id, title, body, tags, media, status, view_count, like_count, comment_count, type, created_at, updated_at, author:profiles!topics_author_id_fkey(id,username,display_name,avatar_url,last_seen,premium_until)"
            )
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(50);
          data = fallback.data;
        }

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
          is_pinned: !!(t as any).is_pinned,
          liked_by_me: likedTopicIds.has(t.id),
        }));

        const sorted =
          tab === "popular"
            ? [...mapped].sort((a, b) => {
                if (!!b.is_pinned !== !!a.is_pinned) {
                  return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
                }
                return scoreTopic(b) - scoreTopic(a);
              })
            : mapped;

        setTopics(sorted);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, supa, tab, tagFilter, interestTags]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.body?.toLowerCase().includes(q)
    );
  }, [topics, deferredQuery]);

  async function handleLike(id: string) {
    if (!currentUserId) return;
    const target = topics.find((t) => t.id === id);
    if (!target) return;
    const liked = target.liked_by_me;
    haptic(liked ? "selection" : "light");

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

  /** Interleave people strip after first 2 topics and again mid-feed. */
  const feedBlocks = useMemo(() => {
    const blocks: (
      | { type: "topic"; topic: TopicWithAuthor; index: number }
      | { type: "people"; key: string; people: FeedPerson[]; title: string }
    )[] = [];

    visible.forEach((topic, i) => {
      blocks.push({ type: "topic", topic, index: i });
      if (i === 1 && people.length > 0) {
        blocks.push({
          type: "people",
          key: "nearby-top",
          people: people.slice(0, 8),
          title: "Новые люди рядом",
        });
      }
      if (i === 6 && people.length > 4) {
        blocks.push({
          type: "people",
          key: "nearby-mid",
          people: people.slice(4, 12),
          title: "Ещё знакомства",
        });
      }
    });

    if (visible.length <= 1 && people.length > 0) {
      blocks.push({
        type: "people",
        key: "nearby-empty",
        people: people.slice(0, 8),
        title: "Новые люди рядом",
      });
    }

    return blocks;
  }, [visible, people]);

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
              Темы сообщества и люди рядом — в одной ленте.
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
          <Metric
            icon={<Sparkles size={14} />}
            label="Темы"
            value={topics.length}
          />
          <Metric
            icon={<Flame size={14} />}
            label="В ленте"
            value={visible.length}
          />
        </div>
      </div>

      <div className="relative mb-3">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по темам и тегам…"
          className="h-11 w-full rounded-xl border border-gold/15 bg-base-900/60 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 backdrop-blur transition-all duration-300 focus:border-gold/45 focus:outline-none focus:ring-2 focus:ring-gold/15"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              !tagFilter
                ? "border-gold/35 bg-gold/15 text-gold-soft"
                : "border-gold/10 text-slate-500 hover:border-gold/25"
            }`}
          >
            Все
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setTagFilter((prev) => (prev === tag ? null : tag))
              }
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                tagFilter === tag
                  ? "border-gold/35 bg-gold/15 text-gold-soft"
                  : "border-gold/10 text-slate-400 hover:border-gold/25"
              }`}
            >
              <Hash size={10} />
              {tag}
            </button>
          ))}
        </div>
      )}

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
        <TabButton
          active={tab === "interests"}
          onClick={() => setTab("interests")}
          icon={<Heart size={15} />}
          label="Интересы"
        />
      </div>

      {loading ? (
        <SkeletonList count={4} variant="topic" />
      ) : visible.length === 0 && people.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={22} />}
          title={
            query.length > 0 || tagFilter
              ? "Ничего не найдено"
              : tab === "interests"
                ? "Нет тем по вашим интересам"
                : "Пока нет активных тем"
          }
          description={
            tab === "interests"
              ? "Добавьте интересы в анкете или создайте тему с вашими тегами"
              : query || tagFilter
                ? "Попробуйте другой запрос или сбросьте тег"
                : "Создайте первую тему и начните обсуждение"
          }
          actionLabel={
            tab === "interests" ? "Моя анкета" : "Создать тему"
          }
          actionHref={tab === "interests" ? "/profile" : "/topic/new"}
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {feedBlocks.map((block) =>
              block.type === "people" ? (
                <PeopleStrip
                  key={block.key}
                  people={block.people}
                  title={block.title}
                />
              ) : (
                <TopicCard
                  key={block.topic.id}
                  topic={block.topic}
                  index={block.index}
                  onLike={handleLike}
                  currentUserId={currentUserId}
                  onTagClick={(tag) => setTagFilter(tag)}
                />
              )
            )}
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
      className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-slate-400 transition-all duration-200 hover:text-warm-100 sm:gap-2 sm:px-4 sm:text-sm"
    >
      {active && (
        <motion.span
          layoutId="feed-tab"
          className="absolute inset-0 rounded-lg border border-gold/20 bg-accent-gradient shadow-glow-accent"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span
        className={`relative z-10 flex items-center gap-1.5 ${active ? "text-white" : ""}`}
      >
        {icon}
        {label}
      </span>
    </button>
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
