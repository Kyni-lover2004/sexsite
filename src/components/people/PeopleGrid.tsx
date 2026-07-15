"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  Calendar,
  Filter,
  MessageCircle,
  CheckCircle2,
  HeartHandshake,
  Heart,
  X,
  Crown,
  Radio,
  Users,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Badge";
import { ageFromBirthDate, isOnline, cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  GENDER_OPTIONS,
  DATING_GOALS,
  SEXUAL_INTERESTS,
  getDatingGoalLabels,
} from "@/lib/data/profileOptions";
import { getCountries, getRegions, getCities } from "@/lib/data/locations";
import {
  PEOPLE_SELECT,
  ONLINE_WINDOW_MS,
  birthDateBounds,
  type PeopleCard,
  type PeopleTab,
} from "@/lib/data/people-shared";
import type { Profile } from "@/lib/types";

const TABS: { id: PeopleTab; label: string; icon: React.ReactNode }[] = [
  { id: "nearby", label: "Рядом", icon: <MapPin size={14} /> },
  { id: "online", label: "Онлайн", icon: <Radio size={14} /> },
  { id: "available", label: "Общаюсь", icon: <Sparkles size={14} /> },
  { id: "mutual", label: "Взаимно", icon: <HeartHandshake size={14} /> },
  { id: "all", label: "Все", icon: <Users size={14} /> },
];

export function PeopleGrid({
  currentUserId,
  initialUsers = [],
  viewerCity = null,
  viewerCountry = null,
}: {
  currentUserId: string | null;
  initialUsers?: PeopleCard[];
  viewerCity?: string | null;
  viewerCountry?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const supa = supabase as any;

  const [users, setUsers] = useState<PeopleCard[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<PeopleTab>("nearby");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [likeBusy, setLikeBusy] = useState<string | null>(null);
  const skipFirst = useRef(true);

  const [filters, setFilters] = useState({
    gender: "",
    country: viewerCountry ?? "",
    region: "",
    city: viewerCity ?? "",
    interests: [] as string[],
    datingGoals: [] as string[],
    minAge: "",
    maxAge: "",
  });

  const countries = useMemo(() => getCountries(), []);
  const regions = useMemo(
    () => getRegions(filters.country),
    [filters.country]
  );
  const cities = useMemo(
    () => getCities(filters.country, filters.region),
    [filters.country, filters.region]
  );

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      // Mutual tab needs likes table
      if (tab === "mutual" && currentUserId) {
        const [{ data: iLiked }, { data: likedMe }] = await Promise.all([
          supa.from("profile_likes").select("to_id").eq("from_id", currentUserId),
          supa.from("profile_likes").select("from_id").eq("to_id", currentUserId),
        ]);
        const a = new Set((iLiked ?? []).map((r: any) => r.to_id as string));
        const b = new Set((likedMe ?? []).map((r: any) => r.from_id as string));
        const mutualIds = [...a].filter((id) => b.has(id));
        if (mutualIds.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }
        let q = supa
          .from("profiles")
          .select(PEOPLE_SELECT)
          .in("id", mutualIds.slice(0, 80))
          .order("last_seen", { ascending: false })
          .limit(48);
        if (filters.gender) q = q.eq("gender", filters.gender);
        if (filters.city) q = q.eq("city", filters.city);
        const { data } = await q;
        setUsers(
          ((data ?? []) as PeopleCard[]).map((p) => ({
            ...p,
            iLiked: true,
            likedMe: true,
            isMutual: true,
          }))
        );
        setLoading(false);
        return;
      }

      let q = supa.from("profiles").select(PEOPLE_SELECT).limit(48);
      if (currentUserId) q = q.neq("id", currentUserId);

      if (filters.gender) q = q.eq("gender", filters.gender);
      if (filters.country) q = q.eq("country", filters.country);
      if (filters.region) q = q.eq("region", filters.region);
      if (filters.city) q = q.eq("city", filters.city);
      if (filters.interests.length) {
        q = q.overlaps("interests", filters.interests.slice(0, 12));
      }
      if (filters.datingGoals.length) {
        q = q.overlaps("dating_goals", filters.datingGoals.slice(0, 12));
      }

      const { minBirth, maxBirth } = birthDateBounds(
        filters.minAge ? Number(filters.minAge) : null,
        filters.maxAge ? Number(filters.maxAge) : null
      );
      if (minBirth) q = q.gte("birth_date", minBirth);
      if (maxBirth) q = q.lte("birth_date", maxBirth);

      const qText = query.trim().replace(/[%_,.()"'\\]/g, "").slice(0, 60);
      if (qText) {
        q = q.or(
          `username.ilike.%${qText}%,display_name.ilike.%${qText}%,city.ilike.%${qText}%,bio.ilike.%${qText}%`
        );
      }

      if (tab === "online") {
        const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
        q = q.gte("last_seen", since).order("last_seen", { ascending: false });
      } else if (tab === "available") {
        q = q
          .eq("available_for_chat", true)
          .order("last_seen", { ascending: false });
      } else if (tab === "nearby") {
        const city = filters.city || viewerCity;
        const country = filters.country || viewerCountry;
        if (city) q = q.eq("city", city);
        else if (country) q = q.eq("country", country);
        q = q.order("last_seen", { ascending: false });
      } else {
        q = q.order("last_seen", { ascending: false });
      }

      const { data, error } = await q;
      if (error) {
        console.error(error);
        setUsers([]);
        setLoading(false);
        return;
      }

      let rows = (data ?? []) as PeopleCard[];

      // Nearby fallback if city filter empty
      if (tab === "nearby" && rows.length < 6 && viewerCity && !filters.city) {
        const { data: more } = await supa
          .from("profiles")
          .select(PEOPLE_SELECT)
          .neq("id", currentUserId)
          .order("last_seen", { ascending: false })
          .limit(48);
        const seen = new Set(rows.map((r) => r.id));
        for (const p of more ?? []) {
          if (!seen.has(p.id)) rows.push(p as PeopleCard);
        }
      }

      // Enrich likes
      if (currentUserId && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const [{ data: fromMe }, { data: toMe }] = await Promise.all([
          supa
            .from("profile_likes")
            .select("to_id")
            .eq("from_id", currentUserId)
            .in("to_id", ids),
          supa
            .from("profile_likes")
            .select("from_id")
            .eq("to_id", currentUserId)
            .in("from_id", ids),
        ]);
        const iLiked = new Set(
          (fromMe ?? []).map((r: any) => r.to_id as string)
        );
        const likedMe = new Set(
          (toMe ?? []).map((r: any) => r.from_id as string)
        );
        rows = rows.map((p) => ({
          ...p,
          iLiked: iLiked.has(p.id),
          likedMe: likedMe.has(p.id),
          isMutual: iLiked.has(p.id) && likedMe.has(p.id),
        }));
      }

      setUsers(rows);
    } finally {
      setLoading(false);
    }
  }, [
    currentUserId,
    filters,
    query,
    supa,
    tab,
    viewerCity,
    viewerCountry,
  ]);

  // Initial paint uses server data; refetch on tab/filter changes
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const t = window.setTimeout(() => void fetchPeople(), 280);
    return () => window.clearTimeout(t);
  }, [fetchPeople]);

  async function toggleLike(userId: string) {
    if (!currentUserId) return;
    setLikeBusy(userId);
    const target = users.find((u) => u.id === userId);
    const liked = !!target?.iLiked;

    haptic(liked ? "selection" : "success");

    // Optimistic
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const iLiked = !liked;
        const isMutual = iLiked && !!u.likedMe;
        return { ...u, iLiked, isMutual };
      })
    );

    if (liked) {
      await supa
        .from("profile_likes")
        .delete()
        .eq("from_id", currentUserId)
        .eq("to_id", userId);
    } else {
      const { error } = await supa.from("profile_likes").insert({
        from_id: currentUserId,
        to_id: userId,
      });
      if (error && error.code !== "23505") {
        // revert
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  iLiked: liked,
                  isMutual: liked && !!u.likedMe,
                }
              : u
          )
        );
      }
    }
    setLikeBusy(null);
  }

  function hasPremium(user: Profile) {
    return !!user.premium_until && new Date(user.premium_until) > new Date();
  }

  function toggleInterestFilter(value: string) {
    setFilters((prev) => ({
      ...prev,
      interests: prev.interests.includes(value)
        ? prev.interests.filter((i) => i !== value)
        : [...prev.interests, value],
    }));
  }

  function toggleDatingGoalFilter(value: string) {
    setFilters((prev) => ({
      ...prev,
      datingGoals: prev.datingGoals.includes(value)
        ? prev.datingGoals.filter((g) => g !== value)
        : [...prev.datingGoals, value],
    }));
  }

  return (
    <div>
      <div className="mb-5">
        <motion.h1
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-bold text-gradient"
        >
          Люди
        </motion.h1>
        <p className="text-sm text-slate-500">
          Интерес без чата · взаимно — особый статус
          {viewerCity ? ` · рядом: ${viewerCity}` : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gold/15 bg-base-900/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              tab === t.id
                ? "bg-accent-gradient text-white shadow-glow-accent"
                : "text-slate-500 hover:text-warm-100"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, город, bio…"
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? "primary" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          title="Фильтры"
        >
          <Filter size={18} />
        </Button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 overflow-hidden"
        >
          <GlassCard className="space-y-4 p-4">
            <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-xs text-slate-500">
                  Я ищу
                </label>
                <select
                  value={filters.gender}
                  onChange={(e) =>
                    setFilters({ ...filters, gender: e.target.value })
                  }
                  className="h-9 w-full min-w-0 rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white"
                >
                  <option value="">Всех</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  Возраст от
                </label>
                <Input
                  type="number"
                  value={filters.minAge}
                  onChange={(e) =>
                    setFilters({ ...filters, minAge: e.target.value })
                  }
                  className="h-9 w-20"
                  min={18}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">до</label>
                <Input
                  type="number"
                  value={filters.maxAge}
                  onChange={(e) =>
                    setFilters({ ...filters, maxAge: e.target.value })
                  }
                  className="h-9 w-20"
                  min={18}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                <MapPin size={12} className="mr-1 inline" />
                Локация
              </label>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <select
                  value={filters.country}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      country: e.target.value,
                      region: "",
                      city: "",
                    })
                  }
                  className="h-9 w-full rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white"
                >
                  <option value="">Страна</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {filters.country && (
                  <select
                    value={filters.region}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        region: e.target.value,
                        city: "",
                      })
                    }
                    className="h-9 w-full rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white"
                  >
                    <option value="">Регион</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                {filters.region && (
                  <select
                    value={filters.city}
                    onChange={(e) =>
                      setFilters({ ...filters, city: e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white"
                  >
                    <option value="">Город</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                {(filters.country || filters.region || filters.city) && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        country: "",
                        region: "",
                        city: "",
                      })
                    }
                    className="flex h-9 items-center gap-1 rounded-lg border border-gold/15 px-2 text-xs text-slate-400"
                  >
                    <X size={12} />
                    Сбросить локацию
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Цель знакомства
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DATING_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => toggleDatingGoalFilter(goal.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      filters.datingGoals.includes(goal.value)
                        ? "border-gold/40 bg-gold/20 text-gold-soft"
                        : "border-gold/10 text-slate-400"
                    )}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Интересы
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SEXUAL_INTERESTS.map((interest) => (
                  <button
                    key={interest.value}
                    type="button"
                    onClick={() => toggleInterestFilter(interest.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      filters.interests.includes(interest.value)
                        ? "border-accent/40 bg-accent/20 text-accent-soft"
                        : "border-gold/10 text-slate-400"
                    )}
                  >
                    {interest.label}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {loading ? (
        <SkeletonList count={4} variant="person" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={
            tab === "mutual"
              ? "Пока нет взаимных интересов"
              : tab === "online"
                ? "Сейчас никто не в сети"
                : tab === "available"
                  ? "Никто не в режиме «общаюсь»"
                  : "Никого не найдено"
          }
          description={
            tab === "mutual"
              ? "Ставьте «Интерес» — когда ответят взаимно, человек появится здесь"
              : "Смените вкладку, ослабьте фильтры или заполните город в анкете"
          }
          actionLabel={tab === "nearby" ? "Заполнить анкету" : "Смотреть всех"}
          actionHref={tab === "nearby" ? "/profile" : undefined}
          onAction={
            tab === "nearby" ? undefined : () => setTab("all")
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.2), duration: 0.3 }}
              className="flex h-full flex-col"
            >
              <GlassCard
                interactive
                className={cn(
                  "group relative flex h-full flex-1 flex-col justify-between overflow-hidden p-4",
                  user.isMutual && "border-rose-400/25 ring-1 ring-rose-400/15"
                )}
              >
                {user.isMutual && (
                  <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                    <HeartHandshake size={10} />
                    Взаимно
                  </span>
                )}
                {user.available_for_chat && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Общаюсь
                  </span>
                )}

                <div className="relative mt-5 flex items-start gap-3">
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name ?? user.username}
                    lastSeen={user.last_seen}
                    showPresence
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${user.id}`}>
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-white hover:text-gold-soft">
                        {user.display_name ?? user.username}
                        {hasPremium(user) && (
                          <Crown
                            size={14}
                            className="shrink-0 fill-current text-gold-soft"
                          />
                        )}
                        {isOnline(user.last_seen) && (
                          <span className="text-[10px] font-normal text-emerald-400">
                            online
                          </span>
                        )}
                      </p>
                    </Link>
                    <p className="text-xs text-slate-500">@{user.username}</p>
                    {user.bio && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {user.bio}
                      </p>
                    )}
                    {getDatingGoalLabels(user.dating_goals, user.dating_goal)
                      .length > 0 && (
                      <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-soft">
                        <HeartHandshake size={11} />
                        <span className="truncate">
                          {getDatingGoalLabels(
                            user.dating_goals,
                            user.dating_goal
                          ).join(" · ")}
                        </span>
                      </span>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      {user.city && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {user.city}
                        </span>
                      )}
                      {user.birth_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {ageFromBirthDate(user.birth_date)} лет
                        </span>
                      )}
                      {user.available_for_chat && (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={12} />
                          Готов(а) общаться
                        </span>
                      )}
                      {user.likedMe && !user.isMutual && (
                        <span className="text-rose-300/90">
                          Интересуется вами
                        </span>
                      )}
                    </div>
                    {user.interests?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(user.interests ?? []).slice(0, 4).map((interest: string) => (
                          <Tag key={interest} label={interest} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {currentUserId && (
                  <div className="relative mt-3 flex flex-wrap gap-2">
                    <Button
                      variant={user.iLiked ? "primary" : "outline"}
                      size="sm"
                      className="flex-1"
                      disabled={likeBusy === user.id}
                      onClick={() => toggleLike(user.id)}
                    >
                      {likeBusy === user.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Heart
                          size={14}
                          className={user.iLiked ? "fill-current" : ""}
                        />
                      )}
                      {user.isMutual
                        ? "Взаимно"
                        : user.iLiked
                          ? "Есть интерес"
                          : "Интерес"}
                    </Button>
                    <Link
                      href={`/chat/${user.id}`}
                      className="min-w-[7.5rem] flex-1"
                    >
                      <Button
                        size="sm"
                        className={cn(
                          "w-full",
                          user.isMutual
                            ? "bg-emerald-600/90 hover:bg-emerald-600"
                            : ""
                        )}
                        variant={user.isMutual ? "primary" : "outline"}
                      >
                        <MessageCircle size={14} />
                        {user.isMutual ? "Написать ✓" : "Написать"}
                      </Button>
                    </Link>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
