"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  Calendar,
  Filter,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ageFromBirthDate, isOnline } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function PeopleGrid({ currentUserId }: { currentUserId: string | null }) {
  const supabase = createClient();
  const supa = supabase as any;
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    gender: "",
    city: "",
    minAge: "",
    maxAge: "",
    onlineOnly: false,
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
  }, [currentUserId]);

  const filtered = users.filter((u) => {
    if (query) {
      const q = query.toLowerCase();
      const matchesName =
        u.display_name?.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q);
      if (!matchesName) return false;
    }
    if (filters.gender && u.gender !== filters.gender) return false;
    if (filters.city && !u.city?.toLowerCase().includes(filters.city.toLowerCase()))
      return false;
    if (filters.onlineOnly && !isOnline(u.last_seen)) return false;

    const age = ageFromBirthDate(u.birth_date);
    if (filters.minAge && age !== null && age < Number(filters.minAge)) return false;
    if (filters.maxAge && age !== null && age > Number(filters.maxAge)) return false;

    return true;
  });

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
            placeholder="Поиск по имени или био…"
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
          <GlassCard className="flex flex-wrap items-end gap-3 p-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Пол</label>
              <select
                value={filters.gender}
                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                className="h-9 rounded-lg border border-white/[0.08] bg-base-800 px-2 text-sm text-white transition-colors focus:border-accent/50"
              >
                <option value="">Любой</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Город</label>
              <Input
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                placeholder="Любой"
                className="h-9 w-32"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Возраст от
              </label>
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
            >
              <GlassCard interactive className="group relative overflow-hidden p-4">
                {/* Hover glow overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.03] to-gold/[0.02] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

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
                    </div>
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
