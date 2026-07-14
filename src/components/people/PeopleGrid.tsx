"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  Calendar,
  Filter,
  MessageCircle,
  CheckCircle2,
  HeartHandshake,
  X,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Badge";
import { ageFromBirthDate, isOnline } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  GENDER_OPTIONS,
  DATING_GOALS,
  SEXUAL_INTERESTS,
  getDatingGoalLabel,
} from "@/lib/data/profileOptions";
import { getCountries, getRegions, getCities } from "@/lib/data/locations";
import type { Profile } from "@/lib/types";

export function PeopleGrid({ currentUserId }: { currentUserId: string | null }) {
  const supabase = createClient();
  const supa = supabase as any;
  const [users, setUsers] = useState<(Profile & { available_for_chat: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    gender: "",
    country: "",
    region: "",
    city: "",
    interests: [] as string[],
    datingGoals: [] as string[],
    minAge: "",
    maxAge: "",
    onlineOnly: false,
    availableOnly: false,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    supa
      .from("profiles")
      .select("*")
      .neq("id", currentUserId)
      .limit(50)
      .then(({ data }: any) => {
        if (!active) return;
        setUsers((data ?? []) as Profile[]);
        setLoading(false);
      });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const countries = useMemo(() => getCountries(), []);
  const regions = useMemo(() => getRegions(filters.country), [filters.country]);
  const cities = useMemo(() => getCities(filters.country, filters.region), [filters.country, filters.region]);

  const filtered = users.filter((u) => {
    if (query) {
      const q = query.toLowerCase();
      const matchesName =
        u.display_name?.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q) ||
        getDatingGoalLabel(u.dating_goal)?.toLowerCase().includes(q) ||
        u.interests.some((interest) => interest.toLowerCase().includes(q));
      if (!matchesName) return false;
    }
    if (filters.gender && u.gender !== filters.gender) return false;
    if (filters.city && u.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (
      filters.interests.length > 0 &&
      !filters.interests.some((interest) =>
        u.interests.some((ui) => ui.toLowerCase().includes(interest.toLowerCase()))
      )
    )
      return false;
    if (
      filters.datingGoals.length > 0 &&
      !filters.datingGoals.includes(u.dating_goal ?? "")
    )
      return false;
    if (filters.onlineOnly && !isOnline(u.last_seen)) return false;
    if (filters.availableOnly && !u.available_for_chat) return false;

    const age = ageFromBirthDate(u.birth_date);
    if (filters.minAge && age !== null && age < Number(filters.minAge)) return false;
    if (filters.maxAge && age !== null && age > Number(filters.maxAge)) return false;

    return true;
  });

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
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-bold text-gradient"
        >
          Люди
        </motion.h1>
        <p className="text-sm text-slate-500">
          Знакомьтесь и находите новых друзей
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, городу, интересам…"
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
            {/* Row 1: Gender + Age */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Я ищу</label>
                <select
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="h-9 rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white transition-colors focus:border-gold/50"
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
                <label className="mb-1 block text-xs text-slate-500">Возраст от</label>
                <Input
                  type="number"
                  value={filters.minAge}
                  onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                  className="h-9 w-20"
                  min={0}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">до</label>
                <Input
                  type="number"
                  value={filters.maxAge}
                  onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                  className="h-9 w-20"
                  min={0}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={filters.onlineOnly}
                    onChange={(e) =>
                      setFilters({ ...filters, onlineOnly: e.target.checked })
                    }
                    className="rounded border-white/20 bg-base-800 accent-accent"
                  />
                  Только онлайн
                </label>
                <label className="flex items-center gap-2 text-sm text-emerald-400">
                  <input
                    type="checkbox"
                    checked={filters.availableOnly}
                    onChange={(e) =>
                      setFilters({ ...filters, availableOnly: e.target.checked })
                    }
                    className="rounded border-white/20 bg-base-800 accent-emerald-500"
                  />
                  Готовы пообщаться
                </label>
              </div>
            </div>

            {/* Row 2: Cascading Location */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                <MapPin size={12} className="mr-1 inline" />
                Локация
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={filters.country}
                  onChange={(e) =>
                    setFilters({ ...filters, country: e.target.value, region: "", city: "" })
                  }
                  className="h-9 rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white transition-colors focus:border-gold/50"
                >
                  <option value="">Страна</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {filters.country && (
                  <select
                    value={filters.region}
                    onChange={(e) =>
                      setFilters({ ...filters, region: e.target.value, city: "" })
                    }
                    className="h-9 rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white transition-colors focus:border-gold/50"
                  >
                    <option value="">Регион</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
                {filters.region && (
                  <select
                    value={filters.city}
                    onChange={(e) =>
                      setFilters({ ...filters, city: e.target.value })
                    }
                    className="h-9 rounded-lg border border-gold/15 bg-base-800 px-2 text-sm text-white transition-colors focus:border-gold/50"
                  >
                    <option value="">Город</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
                {(filters.country || filters.region || filters.city) && (
                  <button
                    onClick={() =>
                      setFilters({ ...filters, country: "", region: "", city: "" })
                    }
                    className="flex items-center gap-1 rounded-lg border border-gold/15 bg-base-800 px-2 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={12} />
                    Сбросить
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: Dating Goals */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                <HeartHandshake size={12} className="mr-1 inline" />
                Цель знакомства
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DATING_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => toggleDatingGoalFilter(goal.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                      filters.datingGoals.includes(goal.value)
                        ? "border-gold/40 bg-gold/20 text-gold-soft"
                        : "border-gold/10 bg-base-800/60 text-slate-400 hover:border-gold/25 hover:text-slate-300"
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Sexual Interests */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Интересы
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SEXUAL_INTERESTS.map((interest) => (
                  <button
                    key={interest.value}
                    onClick={() => toggleInterestFilter(interest.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                      filters.interests.includes(interest.value)
                        ? "border-accent/40 bg-accent/20 text-accent-light"
                        : "border-gold/10 bg-base-800/60 text-slate-400 hover:border-gold/25 hover:text-slate-300"
                    }`}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
          <p className="text-slate-300">Никого не найдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: Math.min(i * 0.05, 0.3),
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col h-full"
            >
              <GlassCard interactive className="group relative flex flex-1 flex-col justify-between overflow-hidden p-4 h-full">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.03] to-gold/[0.02] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                {user.available_for_chat && (
                  <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Общаюсь сейчас
                  </span>
                )}

                <div className="relative flex items-start gap-3">
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name ?? user.username}
                    lastSeen={user.last_seen}
                    showPresence
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${user.id}`}>
                      <p className="font-medium text-white transition-colors hover:text-gradient">
                        {user.display_name ?? user.username}
                      </p>
                    </Link>
                    <p className="text-xs text-slate-500">@{user.username}</p>
                    {user.bio && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {user.bio}
                      </p>
                    )}
                    {getDatingGoalLabel(user.dating_goal) && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[11px] text-gold-soft">
                        <HeartHandshake size={11} />
                        {getDatingGoalLabel(user.dating_goal)}
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
                    </div>
                    {user.interests.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.interests.slice(0, 4).map((interest) => (
                          <Tag key={interest} label={interest} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {currentUserId && (
                  <div className="relative mt-3 flex justify-end">
                    <Link href={`/chat/${user.id}`}>
                      <Button variant="outline" size="sm">
                        <MessageCircle size={14} />
                        Написать
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

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-base-800/40 p-4">
      <div className="flex gap-3">
        <div className="h-14 w-14 rounded-full bg-white/[0.06]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-white/[0.06]" />
          <div className="h-3 w-24 rounded bg-white/[0.04]" />
          <div className="mt-2 h-3 w-full rounded bg-white/[0.04]" />
          <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
