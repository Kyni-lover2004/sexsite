"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  Heart,
  X,
  Star,
  MapPin,
  Calendar,
  Loader2,
  Sparkles,
  MessageCircle,
  User,
  Crown,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Flame,
  HeartHandshake,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tag } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ageFromBirthDate, cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import {
  GENDER_OPTIONS,
  DATING_GOALS,
  getDatingGoalLabels,
  getGenderLabel,
} from "@/lib/data/profileOptions";
import { getCountries, getRegions, getCities } from "@/lib/data/locations";
import {
  PEOPLE_SELECT,
  LIKE_SOURCE_SWIPE,
  birthDateBounds,
} from "@/lib/data/people-shared";
import {
  DEFAULT_SWIPE_FILTERS,
  loadSwipeFilters,
  saveSwipeFilters,
  type SwipeAction,
  type SwipeActionResult,
  type SwipeCard,
  type SwipeFilters,
  type SwipePhoto,
} from "@/lib/data/swipes-shared";
import type { Profile } from "@/lib/types";

type Tab = "filters" | "deck" | "likes";
type LikesSub = "received" | "sent" | "mutual";

const DECK_LIMIT = 40;

export function SwipeExperience({
  currentUserId,
  isPremium,
  viewerCity,
  viewerCountry,
  initialTab = "deck",
  initialLikesCount = 0,
}: {
  currentUserId: string;
  isPremium: boolean;
  viewerCity: string | null;
  viewerCountry: string | null;
  initialTab?: "deck" | "likes";
  initialLikesCount?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const supa = supabase as any;

  const [tab, setTab] = useState<Tab>("filters");
  const [filters, setFilters] = useState<SwipeFilters>({
    ...DEFAULT_SWIPE_FILTERS,
    city: viewerCity ?? "",
    country: viewerCountry ?? "",
  });
  const [filtersReady, setFiltersReady] = useState(false);

  const [deck, setDeck] = useState<SwipeCard[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState("");
  const [acting, setActing] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragHint, setDragHint] = useState<"like" | "pass" | null>(null);

  const [match, setMatch] = useState<SwipeCard | null>(null);
  const [toast, setToast] = useState("");

  const [likesSub, setLikesSub] = useState<LikesSub>("received");
  const [received, setReceived] = useState<
    {
      from_id: string;
      is_superlike: boolean;
      created_at: string;
      is_mutual: boolean;
      profile: Profile | null;
      photos: SwipePhoto[];
    }[]
  >([]);
  const [sent, setSent] = useState<
    {
      to_id: string;
      is_superlike: boolean;
      created_at: string;
      is_mutual: boolean;
      profile: Profile | null;
      photos: SwipePhoto[];
    }[]
  >([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount);

  const countries = useMemo(() => getCountries(), []);
  const regions = useMemo(
    () => getRegions(filters.country),
    [filters.country]
  );
  const cities = useMemo(
    () => getCities(filters.country, filters.region),
    [filters.country, filters.region]
  );

  // Boot: restore filters or start on filters screen
  useEffect(() => {
    const saved = loadSwipeFilters();
    if (saved) {
      setFilters({
        ...DEFAULT_SWIPE_FILTERS,
        ...saved,
        country: saved.country || viewerCountry || "",
        city: saved.city || viewerCity || "",
      });
      setFiltersReady(true);
      setTab(initialTab === "likes" ? "likes" : "deck");
    } else {
      setFilters((f) => ({
        ...f,
        country: viewerCountry || f.country,
        city: viewerCity || f.city,
      }));
      setTab(initialTab === "likes" ? "likes" : "filters");
      setFiltersReady(true);
    }
  }, [initialTab, viewerCity, viewerCountry]);

  const fetchPhotos = useCallback(
    async (userIds: string[]): Promise<Record<string, SwipePhoto[]>> => {
      if (userIds.length === 0) return {};
      const { data } = await supa
        .from("profile_photos")
        .select("id, user_id, url, sort_order, album_id")
        .in("user_id", userIds.slice(0, 80))
        .is("album_id", null)
        .order("sort_order", { ascending: true });
      const map: Record<string, SwipePhoto[]> = {};
      for (const row of data ?? []) {
        const uid = row.user_id as string;
        if (!map[uid]) map[uid] = [];
        if (map[uid].length >= 6) continue;
        map[uid].push({
          id: row.id,
          url: row.url,
          sort_order: row.sort_order ?? 0,
        });
      }
      return map;
    },
    [supa]
  );

  const loadDeck = useCallback(async () => {
    setDeckLoading(true);
    setDeckError("");
    try {
      // Exclusions — only SWIPE likes / passes (search likes stay independent)
      const [{ data: liked }, { data: passed }, { data: likedMeRows }] =
        await Promise.all([
          supa
            .from("profile_likes")
            .select("to_id")
            .eq("from_id", currentUserId)
            .eq("source", LIKE_SOURCE_SWIPE),
          supa.from("profile_passes").select("to_id").eq("from_id", currentUserId),
          supa
            .from("profile_likes")
            .select("from_id, is_superlike")
            .eq("to_id", currentUserId)
            .eq("source", LIKE_SOURCE_SWIPE),
        ]);

      const exclude = new Set<string>([
        currentUserId,
        ...((liked ?? []).map((r: any) => r.to_id as string) as string[]),
        ...((passed ?? []).map((r: any) => r.to_id as string) as string[]),
      ]);

      const likedMeMap = new Map<string, boolean>();
      for (const r of likedMeRows ?? []) {
        likedMeMap.set(r.from_id, !!r.is_superlike);
      }

      let query = supa
        .from("profiles")
        .select(PEOPLE_SELECT)
        .neq("id", currentUserId)
        .limit(DECK_LIMIT * 2);

      if (filters.gender) query = query.eq("gender", filters.gender);
      if (filters.country) query = query.eq("country", filters.country);
      if (filters.region) query = query.eq("region", filters.region);
      if (filters.city) query = query.eq("city", filters.city);
      if (filters.datingGoals.length) {
        query = query.overlaps(
          "dating_goals",
          filters.datingGoals.slice(0, 12)
        );
      }

      const minAge = filters.minAge ? Number(filters.minAge) : null;
      const maxAge = filters.maxAge ? Number(filters.maxAge) : null;
      const { minBirth, maxBirth } = birthDateBounds(minAge, maxAge);
      if (minBirth) query = query.gte("birth_date", minBirth);
      if (maxBirth) query = query.lte("birth_date", maxBirth);

      query = query.order("last_seen", { ascending: false });

      let { data, error } = await query;
      if (error) {
        // Soften if is_banned filter needed etc.
        console.error("swipe deck:", error.message);
        setDeckError("Не удалось загрузить анкеты");
        setDeck([]);
        return;
      }

      let rows = ((data ?? []) as Profile[]).filter((p) => !exclude.has(p.id));

      // If city too strict and few results — relax city
      if (rows.length < 8 && filters.city) {
        let q2 = supa
          .from("profiles")
          .select(PEOPLE_SELECT)
          .neq("id", currentUserId)
          .limit(DECK_LIMIT * 2)
          .order("last_seen", { ascending: false });
        if (filters.gender) q2 = q2.eq("gender", filters.gender);
        if (filters.country) q2 = q2.eq("country", filters.country);
        if (filters.region) q2 = q2.eq("region", filters.region);
        const minA = filters.minAge ? Number(filters.minAge) : null;
        const maxA = filters.maxAge ? Number(filters.maxAge) : null;
        const b = birthDateBounds(minA, maxA);
        if (b.minBirth) q2 = q2.gte("birth_date", b.minBirth);
        if (b.maxBirth) q2 = q2.lte("birth_date", b.maxBirth);
        const more = await q2;
        const seen = new Set(rows.map((r) => r.id));
        for (const p of (more.data ?? []) as Profile[]) {
          if (exclude.has(p.id) || seen.has(p.id)) continue;
          rows.push(p);
          if (rows.length >= DECK_LIMIT) break;
        }
      }

      // Sort: superliked me → liked me → rest by last_seen
      rows.sort((a, b) => {
        const as = likedMeMap.get(a.id);
        const bs = likedMeMap.get(b.id);
        const aScore = as === true ? 2 : as === false ? 1 : 0;
        const bScore = bs === true ? 2 : bs === false ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        return (
          new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        );
      });

      rows = rows.slice(0, DECK_LIMIT);
      const photoMap = await fetchPhotos(rows.map((r) => r.id));

      setDeck(
        rows.map((p) => ({
          ...p,
          photos: photoMap[p.id] ?? [],
          likedMe: likedMeMap.has(p.id),
          superlikedMe: likedMeMap.get(p.id) === true,
        }))
      );
      setPhotoIdx(0);
    } finally {
      setDeckLoading(false);
    }
  }, [currentUserId, filters, fetchPhotos, supa]);

  const loadLikes = useCallback(async () => {
    setLikesLoading(true);
    try {
      // SWIPE stream only
      let receivedRows: any[] = [];
      const rpc = await supa.rpc("get_swipe_likes_received", { p_limit: 60 });
      if (!rpc.error && Array.isArray(rpc.data)) {
        receivedRows = rpc.data;
      } else {
        const { data } = await supa
          .from("profile_likes")
          .select("from_id, is_superlike, created_at")
          .eq("to_id", currentUserId)
          .eq("source", LIKE_SOURCE_SWIPE)
          .order("created_at", { ascending: false })
          .limit(60);
        const { data: myLikes } = await supa
          .from("profile_likes")
          .select("to_id")
          .eq("from_id", currentUserId)
          .eq("source", LIKE_SOURCE_SWIPE);
        const mine = new Set(
          (myLikes ?? []).map((r: any) => r.to_id as string)
        );
        receivedRows = (data ?? []).map((r: any) => ({
          ...r,
          is_superlike: !!r.is_superlike,
          is_mutual: mine.has(r.from_id),
        }));
        receivedRows.sort(
          (a, b) => Number(b.is_superlike) - Number(a.is_superlike)
        );
      }

      const { data: sentRows } = await supa
        .from("profile_likes")
        .select("to_id, is_superlike, created_at")
        .eq("from_id", currentUserId)
        .eq("source", LIKE_SOURCE_SWIPE)
        .order("created_at", { ascending: false })
        .limit(60);

      const { data: whoLikedMe } = await supa
        .from("profile_likes")
        .select("from_id")
        .eq("to_id", currentUserId)
        .eq("source", LIKE_SOURCE_SWIPE);
      const likedMeSet = new Set(
        (whoLikedMe ?? []).map((r: any) => r.from_id as string)
      );

      const allIds = [
        ...new Set([
          ...receivedRows.map((r) => r.from_id as string),
          ...((sentRows ?? []).map((r: any) => r.to_id as string) as string[]),
        ]),
      ];

      let profiles: Profile[] = [];
      if (allIds.length) {
        const { data: profs } = await supa
          .from("profiles")
          .select(PEOPLE_SELECT)
          .in("id", allIds);
        profiles = (profs ?? []) as Profile[];
      }
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      const photos = await fetchPhotos(allIds);

      setReceived(
        receivedRows.map((r) => ({
          from_id: r.from_id,
          is_superlike: !!r.is_superlike,
          created_at: r.created_at,
          is_mutual: !!r.is_mutual,
          profile: pmap.get(r.from_id) ?? null,
          photos: photos[r.from_id] ?? [],
        }))
      );
      setSent(
        (sentRows ?? []).map((r: any) => ({
          to_id: r.to_id,
          is_superlike: !!r.is_superlike,
          created_at: r.created_at,
          is_mutual: likedMeSet.has(r.to_id),
          profile: pmap.get(r.to_id) ?? null,
          photos: photos[r.to_id] ?? [],
        }))
      );
      setLikesCount(receivedRows.length);
    } finally {
      setLikesLoading(false);
    }
  }, [currentUserId, fetchPhotos, supa]);

  useEffect(() => {
    if (!filtersReady) return;
    if (tab === "deck") void loadDeck();
    if (tab === "likes") void loadLikes();
  }, [tab, filtersReady, loadDeck, loadLikes]);

  function startSwiping() {
    saveSwipeFilters(filters);
    setFiltersReady(true);
    setTab("deck");
    haptic("success");
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function doAction(action: SwipeAction, card?: SwipeCard) {
    const target = card ?? deck[0];
    if (!target || acting) return;
    setActing(true);

    if (action === "superlike" && !isPremium) {
      setActing(false);
      showToast("Суперлайк — только для Premium");
      return;
    }

    haptic(action === "pass" ? "selection" : "success");

    // Optimistic remove from deck
    setDeck((d) => d.filter((c) => c.id !== target.id));
    setPhotoIdx(0);
    setDragHint(null);

    let result: SwipeActionResult = { ok: false };

    const rpc = await supa.rpc("swipe_action", {
      p_to_id: target.id,
      p_action: action,
    });

    if (!rpc.error && rpc.data) {
      result = rpc.data as SwipeActionResult;
    } else {
      // Fallback without RPC (SQL not applied yet)
      result = await fallbackAction(action, target.id);
    }

    if (!result.ok) {
      // restore card
      setDeck((d) => [target, ...d]);
      if (result.error === "premium_required") {
        showToast("Нужен Premium для суперлайка");
      } else if (result.error === "superlike_limit") {
        showToast("Лимит суперлайков на сегодня");
      } else if (result.error === "swipe_daily_limit") {
        showToast(
          isPremium
            ? "Лимит лайков на сегодня (100). Завтра снова."
            : "Лимит лайков: 10/день. Пасс бесплатно. Premium — 100 лайков."
        );
      } else if (result.error === "rate_limit") {
        showToast("Слишком много действий. Подождите");
      } else {
        showToast("Не удалось сохранить действие");
      }
      setActing(false);
      return;
    }

    if (action !== "pass") {
      void import("@/lib/analytics").then(({ trackEvent }) =>
        trackEvent("first_like", { to_id: target.id, source: "swipe", action })
      );
    }

    if (result.mutual) {
      setMatch({ ...target, isMutual: true });
      haptic("success");
    } else if (action === "superlike") {
      showToast("Суперлайк отправлен ✨");
    }

    setActing(false);
  }

  async function fallbackAction(
    action: SwipeAction,
    toId: string
  ): Promise<SwipeActionResult> {
    try {
      if (action === "pass") {
        await supa
          .from("profile_likes")
          .delete()
          .eq("from_id", currentUserId)
          .eq("to_id", toId)
          .eq("source", LIKE_SOURCE_SWIPE);
        await supa
          .from("profile_passes")
          .upsert({ from_id: currentUserId, to_id: toId });
        return { ok: true, action: "pass", mutual: false };
      }

      if (action === "superlike" && !isPremium) {
        return { ok: false, error: "premium_required" };
      }

      await supa
        .from("profile_passes")
        .delete()
        .eq("from_id", currentUserId)
        .eq("to_id", toId);

      const payload: any = {
        from_id: currentUserId,
        to_id: toId,
        source: LIKE_SOURCE_SWIPE,
      };
      if (action === "superlike") payload.is_superlike = true;

      let { error } = await supa.from("profile_likes").upsert(payload, {
        onConflict: "from_id,to_id,source",
      });
      if (error) {
        // Older unique(from_id,to_id) or missing columns
        const ins = await supa.from("profile_likes").insert(payload);
        error = ins.error;
        if (error && error.code !== "23505") {
          const plain = await supa.from("profile_likes").insert({
            from_id: currentUserId,
            to_id: toId,
          });
          if (plain.error && plain.error.code !== "23505") {
            return { ok: false, error: plain.error.message };
          }
        }
      }

      // Mutual only if they liked you via swipe too
      const { data: back } = await supa
        .from("profile_likes")
        .select("from_id")
        .eq("from_id", toId)
        .eq("to_id", currentUserId)
        .eq("source", LIKE_SOURCE_SWIPE)
        .maybeSingle();

      return {
        ok: true,
        action,
        mutual: !!back,
        is_superlike: action === "superlike",
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "fail" };
    }
  }

  async function likeBack(fromId: string) {
    const card = received.find((r) => r.from_id === fromId);
    if (!card?.profile) return;
    setActing(true);
    const rpc = await supa.rpc("swipe_action", {
      p_to_id: fromId,
      p_action: "like",
    });
    let result: SwipeActionResult =
      !rpc.error && rpc.data
        ? (rpc.data as SwipeActionResult)
        : await fallbackAction("like", fromId);

    if (result.ok) {
      setReceived((prev) =>
        prev.map((r) =>
          r.from_id === fromId ? { ...r, is_mutual: true } : r
        )
      );
      setSent((prev) => {
        if (prev.some((s) => s.to_id === fromId)) {
          return prev.map((s) =>
            s.to_id === fromId ? { ...s, is_mutual: true } : s
          );
        }
        return [
          {
            to_id: fromId,
            is_superlike: false,
            created_at: new Date().toISOString(),
            is_mutual: true,
            profile: card.profile,
            photos: card.photos,
          },
          ...prev,
        ];
      });
      if (result.mutual || true) {
        // after like-back always mutual if they liked us
        setMatch({
          ...card.profile,
          photos: card.photos,
          isMutual: true,
        } as SwipeCard);
      }
    } else {
      showToast("Не удалось ответить лайком");
    }
    setActing(false);
  }

  const top = deck[0] ?? null;
  const next = deck[1] ?? null;

  const topImages = useMemo(() => {
    if (!top) return [] as string[];
    const urls = top.photos.map((p) => p.url).filter(Boolean);
    if (top.avatar_url && !urls.includes(top.avatar_url)) {
      return [top.avatar_url, ...urls];
    }
    if (urls.length) return urls;
    if (top.avatar_url) return [top.avatar_url];
    return [];
  }, [top]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const x = info.offset.x;
    const v = info.velocity.x;
    if (x > 120 || v > 800) void doAction("like");
    else if (x < -120 || v < -800) void doAction("pass");
    setDragHint(null);
  }

  function onDrag(_: unknown, info: PanInfo) {
    if (info.offset.x > 40) setDragHint("like");
    else if (info.offset.x < -40) setDragHint("pass");
    else setDragHint(null);
  }

  const mutualList = useMemo(
    () => received.filter((r) => r.is_mutual),
    [received]
  );

  // ---------- Filters screen ----------
  if (tab === "filters") {
    return (
      <div className="mx-auto max-w-lg">
        <Header
          tab={tab}
          setTab={setTab}
          likesCount={likesCount}
          filtersReady={filtersReady}
        />
        <GlassCard className="space-y-5 p-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-gradient">
              Настройте поиск
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Фильтры → свайпы. Лайк / пасс / суперлайк (Premium). Анкета
              откроется только после взаимного лайка.
            </p>
          </div>

          <Field label="Кого ищете">
            <select
              value={filters.gender}
              onChange={(e) =>
                setFilters((f) => ({ ...f, gender: e.target.value }))
              }
              className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white"
            >
              <option value="">Неважно</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Возраст от">
              <input
                type="number"
                min={18}
                max={99}
                value={filters.minAge}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minAge: e.target.value }))
                }
                placeholder="18"
                className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white"
              />
            </Field>
            <Field label="до">
              <input
                type="number"
                min={18}
                max={99}
                value={filters.maxAge}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, maxAge: e.target.value }))
                }
                placeholder="99"
                className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white"
              />
            </Field>
          </div>

          <Field label="Страна">
            <select
              value={filters.country}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  country: e.target.value,
                  region: "",
                  city: "",
                }))
              }
              className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white"
            >
              <option value="">Любая</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Регион">
            <select
              value={filters.region}
              disabled={!filters.country}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  region: e.target.value,
                  city: "",
                }))
              }
              className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white disabled:opacity-40"
            >
              <option value="">Любой</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Город">
            <select
              value={filters.city}
              disabled={!filters.region && cities.length === 0}
              onChange={(e) =>
                setFilters((f) => ({ ...f, city: e.target.value }))
              }
              className="h-11 w-full rounded-xl border border-gold/15 bg-base-800 px-3 text-sm text-white disabled:opacity-40"
            >
              <option value="">Любой</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <p className="mb-2 text-xs text-slate-500">Цели (опционально)</p>
            <div className="flex flex-wrap gap-2">
              {DATING_GOALS.map((g) => {
                const on = filters.datingGoals.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        datingGoals: on
                          ? f.datingGoals.filter((x) => x !== g.value)
                          : [...f.datingGoals, g.value],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      on
                        ? "border-gold/40 bg-gold/15 text-gold-soft"
                        : "border-gold/10 text-slate-500 hover:border-gold/25"
                    )}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={startSwiping}>
            <Flame size={18} />
            К свайпам
          </Button>
        </GlassCard>
      </div>
    );
  }

  // ---------- Likes tab ----------
  if (tab === "likes") {
    type LikeRow = {
      id: string;
      is_superlike: boolean;
      is_mutual: boolean;
      created_at: string;
      profile: Profile | null;
      photos: SwipePhoto[];
      direction: "received" | "sent" | "mutual";
    };

    const rows: LikeRow[] =
      likesSub === "received"
        ? received.map((r) => ({
            id: r.from_id,
            is_superlike: r.is_superlike,
            is_mutual: r.is_mutual,
            created_at: r.created_at,
            profile: r.profile,
            photos: r.photos,
            direction: "received",
          }))
        : likesSub === "sent"
          ? sent.map((s) => ({
              id: s.to_id,
              is_superlike: s.is_superlike,
              is_mutual: s.is_mutual,
              created_at: s.created_at,
              profile: s.profile,
              photos: s.photos,
              direction: "sent",
            }))
          : mutualList.map((r) => ({
              id: r.from_id,
              is_superlike: r.is_superlike,
              is_mutual: true,
              created_at: r.created_at,
              profile: r.profile,
              photos: r.photos,
              direction: "mutual",
            }));

    return (
      <div className="mx-auto max-w-lg">
        <Header
          tab={tab}
          setTab={setTab}
          likesCount={likesCount}
          filtersReady={filtersReady}
        />

        <div className="mb-4 flex gap-1 rounded-xl border border-gold/15 bg-base-900/60 p-1">
          {(
            [
              ["received", "Вас", received.length],
              ["sent", "Вы", sent.length],
              ["mutual", "Взаимно", mutualList.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLikesSub(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium sm:text-sm",
                likesSub === id
                  ? "bg-accent-gradient text-white"
                  : "text-slate-500"
              )}
            >
              {label}
              <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {likesLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Heart size={24} />}
            title="Пока пусто"
            description={
              likesSub === "received"
                ? "Когда кто-то лайкнет вас в свайпах — появится здесь. Суперлайки будут сверху."
                : likesSub === "sent"
                  ? "Лайкайте в колоде — список «Вы» заполнится."
                  : "Взаимный лайк откроет анкету и чат."
            }
            actionLabel="К свайпам"
            onAction={() => setTab("deck")}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const p = row.profile;
              if (!p) return null;
              const cover = row.photos[0]?.url || p.avatar_url || "";
              const age = p.birth_date
                ? ageFromBirthDate(p.birth_date)
                : null;
              const canOpen = row.is_mutual;

              return (
                <GlassCard
                  key={`${row.direction}-${row.id}`}
                  className={cn(
                    "flex gap-3 p-3",
                    row.is_superlike &&
                      !row.is_mutual &&
                      "border-gold/40 shadow-[0_0_28px_rgb(var(--gold-glow)/0.18)] ring-1 ring-gold/30"
                  )}
                >
                  <div
                    className={cn(
                      "relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-base-800",
                      row.is_superlike && "ring-2 ring-gold"
                    )}
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <User size={22} />
                      </div>
                    )}
                    {row.is_superlike && (
                      <span className="absolute left-0.5 top-0.5 rounded bg-gold/90 px-1 text-[9px] font-bold text-base-950">
                        ★ SUPER
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="truncate font-semibold text-warm-100">
                          {p.display_name || p.username}
                          {age != null ? `, ${age}` : ""}
                        </p>
                        {p.city && (
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin size={11} />
                            {p.city}
                          </p>
                        )}
                      </div>
                      {row.is_mutual && (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Взаимно
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {canOpen ? (
                        <>
                          <Link href={`/profile/${p.id}`}>
                            <Button size="sm" variant="outline">
                              <User size={14} />
                              Анкета
                            </Button>
                          </Link>
                          <Link href={`/chat/${p.id}`}>
                            <Button size="sm">
                              <MessageCircle size={14} />
                              Написать
                            </Button>
                          </Link>
                        </>
                      ) : row.direction === "received" ? (
                        <Button
                          size="sm"
                          disabled={acting}
                          onClick={() => likeBack(row.id)}
                        >
                          <Heart size={14} className="fill-current" />
                          Лайк в ответ
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Ждём ответа · анкета закрыта до взаимности
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {match && (
          <MatchModal match={match} onClose={() => setMatch(null)} />
        )}
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  // ---------- Deck ----------
  return (
    <div className="mx-auto max-w-lg">
      <Header
        tab={tab}
        setTab={setTab}
        likesCount={likesCount}
        filtersReady={filtersReady}
      />

      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => setTab("filters")}
          className="inline-flex items-center gap-1 rounded-lg border border-gold/15 px-2.5 py-1.5 hover:border-gold/30 hover:text-warm-100"
        >
          <Filter size={12} />
          Фильтры
        </button>
        <button
          type="button"
          onClick={() => void loadDeck()}
          className="inline-flex items-center gap-1 rounded-lg border border-gold/15 px-2.5 py-1.5 hover:border-gold/30 hover:text-warm-100"
        >
          <RotateCcw size={12} />
          Обновить
        </button>
      </div>

      {deckLoading && deck.length === 0 ? (
        <div className="flex h-[28rem] items-center justify-center rounded-3xl border border-gold/10 bg-base-900/40">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : !top ? (
        <EmptyState
          icon={<Sparkles size={24} />}
          title="Колода пуста"
          description={
            deckError ||
            "Никого по фильтрам. Расширьте город/возраст или зайдите позже."
          }
          actionLabel="Изменить фильтры"
          onAction={() => setTab("filters")}
        />
      ) : (
        <div className="relative mx-auto h-[min(70vh,34rem)] w-full">
          {/* Next card peek */}
          {next && (
            <div className="absolute inset-x-3 bottom-2 top-4 overflow-hidden rounded-3xl border border-gold/10 bg-base-900 opacity-50">
              <CardFace
                card={next}
                imageUrl={
                  next.photos[0]?.url || next.avatar_url || ""
                }
                photoIdx={0}
                photoCount={1}
              />
            </div>
          )}

          <AnimatePresence mode="popLayout">
            <motion.div
              key={top.id}
              className="absolute inset-0 touch-pan-y"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              style={{ zIndex: 2 }}
            >
              <div
                className={cn(
                  "relative h-full overflow-hidden rounded-3xl border bg-base-900 shadow-2xl",
                  top.superlikedMe
                    ? "border-gold/50 shadow-[0_0_40px_rgb(var(--gold-glow)/0.25)]"
                    : "border-gold/20"
                )}
              >
                {/* Photo tap zones */}
                <div className="absolute inset-0 z-10 flex">
                  <button
                    type="button"
                    className="h-full w-1/3"
                    aria-label="Предыдущее фото"
                    onClick={() =>
                      setPhotoIdx((i) => Math.max(0, i - 1))
                    }
                  />
                  <div className="h-full w-1/3" />
                  <button
                    type="button"
                    className="h-full w-1/3"
                    aria-label="Следующее фото"
                    onClick={() =>
                      setPhotoIdx((i) =>
                        Math.min(topImages.length - 1, i + 1)
                      )
                    }
                  />
                </div>

                <CardFace
                  card={top}
                  imageUrl={topImages[photoIdx] || topImages[0] || ""}
                  photoIdx={photoIdx}
                  photoCount={topImages.length}
                />

                {/* Drag stamps */}
                <AnimatePresence>
                  {dragHint === "like" && (
                    <motion.div
                      initial={{ opacity: 0, rotate: -12 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute left-6 top-10 z-20 rounded-xl border-4 border-emerald-400 px-4 py-2 text-2xl font-black uppercase tracking-widest text-emerald-400"
                    >
                      Like
                    </motion.div>
                  )}
                  {dragHint === "pass" && (
                    <motion.div
                      initial={{ opacity: 0, rotate: 12 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute right-6 top-10 z-20 rounded-xl border-4 border-rose-400 px-4 py-2 text-2xl font-black uppercase tracking-widest text-rose-400"
                    >
                      Nope
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {top && (
        <div className="relative z-10 mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={acting}
            onClick={() => void doAction("pass")}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-base-900 text-rose-400 shadow-lg transition hover:scale-105 hover:bg-rose-500/10 disabled:opacity-50"
            title="Не интересно"
          >
            <X size={28} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            disabled={acting}
            onClick={() => void doAction("superlike")}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition hover:scale-105 disabled:opacity-50",
              isPremium
                ? "border-gold/40 bg-gold/15 text-gold"
                : "border-gold/15 bg-base-900 text-slate-600"
            )}
            title={
              isPremium
                ? "Суперлайк — выделит вас у них"
                : "Суперлайк для Premium"
            }
          >
            {isPremium ? (
              <Star size={22} className="fill-current" />
            ) : (
              <Crown size={20} />
            )}
          </button>

          <button
            type="button"
            disabled={acting}
            onClick={() => void doAction("like")}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-400 shadow-lg transition hover:scale-105 hover:bg-emerald-500/25 disabled:opacity-50"
            title="Лайк"
          >
            <Heart size={30} className="fill-current" />
          </button>
        </div>
      )}

      {!isPremium && top && (
        <p className="mt-3 text-center text-[11px] text-slate-500">
          <Link href="/premium" className="text-gold-soft underline">
            Premium
          </Link>
          {" · "}
          суперлайк поднимает вас в топ у другого человека
        </p>
      )}

      <p className="mt-4 text-center text-[11px] text-slate-600">
        Свайп вправо — лайк · влево — пасс · анкета только после взаимности
      </p>

      {match && <MatchModal match={match} onClose={() => setMatch(null)} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

function Header({
  tab,
  setTab,
  likesCount,
  filtersReady,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  likesCount: number;
  filtersReady: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gradient">
            Свайпы
          </h1>
          <p className="text-sm text-slate-500">
            Только свайпы · лайки поиска сюда не попадают
          </p>
        </div>
      </div>
      <div className="flex gap-1 rounded-xl border border-gold/15 bg-base-900/60 p-1">
        <button
          type="button"
          onClick={() => setTab("filters")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium sm:text-sm",
            tab === "filters"
              ? "bg-accent-gradient text-white"
              : "text-slate-500"
          )}
        >
          <Filter size={14} />
          Фильтры
        </button>
        <button
          type="button"
          onClick={() => {
            if (!filtersReady && tab === "filters") return;
            setTab("deck");
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium sm:text-sm",
            tab === "deck"
              ? "bg-accent-gradient text-white"
              : "text-slate-500"
          )}
        >
          <Flame size={14} />
          Колода
        </button>
        <button
          type="button"
          onClick={() => setTab("likes")}
          className={cn(
            "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium sm:text-sm",
            tab === "likes"
              ? "bg-accent-gradient text-white"
              : "text-slate-500"
          )}
        >
          <Heart size={14} />
          Лайки
          {likesCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {likesCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function CardFace({
  card,
  imageUrl,
  photoIdx,
  photoCount,
}: {
  card: SwipeCard;
  imageUrl: string;
  photoIdx: number;
  photoCount: number;
}) {
  const age = card.birth_date ? ageFromBirthDate(card.birth_date) : null;
  const goals = getDatingGoalLabels(card.dating_goals, card.dating_goal);

  return (
    <>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-base-800 to-base-950">
          <User size={64} className="text-slate-700" />
        </div>
      )}

      {/* Photo indicators */}
      {photoCount > 1 && (
        <div className="absolute left-3 right-3 top-3 z-[5] flex gap-1">
          {Array.from({ length: photoCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                i === photoIdx ? "bg-white" : "bg-white/30"
              )}
            />
          ))}
        </div>
      )}

      {photoCount > 1 && (
        <>
          {photoIdx > 0 && (
            <ChevronLeft
              size={20}
              className="pointer-events-none absolute left-2 top-1/2 z-[5] -translate-y-1/2 text-white/50"
            />
          )}
          {photoIdx < photoCount - 1 && (
            <ChevronRight
              size={20}
              className="pointer-events-none absolute right-2 top-1/2 z-[5] -translate-y-1/2 text-white/50"
            />
          )}
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 pt-24">
        {card.superlikedMe && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gold">
            <Star size={12} className="fill-current" />
            Суперлайк вам
          </div>
        )}
        {card.likedMe && !card.superlikedMe && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-200">
            <Heart size={12} className="fill-current" />
            Уже лайкнул(а) вас
          </div>
        )}

        <h2 className="font-display text-2xl font-bold text-white drop-shadow">
          {card.display_name || card.username}
          {age != null ? (
            <span className="font-normal text-white/90">, {age}</span>
          ) : null}
        </h2>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
          {card.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} />
              {card.city}
              {card.region ? ` · ${card.region}` : ""}
            </span>
          )}
          {getGenderLabel(card.gender) && (
            <span>{getGenderLabel(card.gender)}</span>
          )}
          {card.birth_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} />
              {age} лет
            </span>
          )}
        </div>

        {card.bio && (
          <p className="mt-2 line-clamp-3 text-sm text-white/75">{card.bio}</p>
        )}

        {goals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {goals.slice(0, 3).map((g) => (
              <span
                key={g}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/85"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {(card.interests ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(card.interests ?? []).slice(0, 4).map((i) => (
              <Tag key={i} label={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MatchModal({
  match,
  onClose,
}: {
  match: SwipeCard;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-gold/25 bg-base-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <HeartHandshake size={32} />
          </div>
        </div>
        <h3 className="text-center font-display text-xl font-bold text-gradient">
          Это взаимно!
        </h3>
        <p className="mt-2 text-center text-sm text-slate-400">
          Вы и{" "}
          <span className="text-warm-100">
            {match.display_name || match.username}
          </span>{" "}
          лайкнули друг друга. Теперь можно открыть анкету и написать.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={`/chat/${match.id}`} onClick={onClose}>
            <Button className="w-full">
              <MessageCircle size={16} />
              Написать
            </Button>
          </Link>
          <Link href={`/profile/${match.id}`} onClick={onClose}>
            <Button className="w-full" variant="outline">
              <User size={16} />
              Смотреть анкету
            </Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Продолжить свайпы
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-gold/25 bg-base-900/95 px-4 py-2 text-sm text-warm-100 shadow-xl backdrop-blur">
      {msg}
    </div>
  );
}
