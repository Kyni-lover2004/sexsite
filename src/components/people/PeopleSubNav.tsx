"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Heart, Search, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function PeopleSubNav({ likesCount = 0 }: { likesCount?: number }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const likesTab = search?.get("tab") === "likes";
  const onSwipe = pathname.startsWith("/people/swipe");
  const onSearch = pathname === "/people";

  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-gold/15 bg-base-900/60 p-1">
      <Link
        href="/people"
        className={cn(
          "relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          onSearch
            ? "bg-accent-gradient text-white shadow-glow-accent"
            : "text-slate-500 hover:text-warm-100"
        )}
      >
        <Search size={16} />
        Поиск
      </Link>
      <Link
        href="/people/swipe"
        className={cn(
          "relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          onSwipe && !likesTab
            ? "bg-accent-gradient text-white shadow-glow-accent"
            : "text-slate-500 hover:text-warm-100"
        )}
      >
        <Flame size={16} />
        Свайпы
      </Link>
      <Link
        href="/people/swipe?tab=likes"
        className={cn(
          "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          onSwipe && likesTab
            ? "bg-accent-gradient text-white shadow-glow-accent"
            : "text-slate-500 hover:text-rose-200"
        )}
        title="Кто лайкнул"
      >
        <Heart size={16} className="fill-current opacity-80" />
        Лайки
        {likesCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-bold text-white">
            {likesCount > 99 ? "99+" : likesCount}
          </span>
        )}
      </Link>
    </div>
  );
}
