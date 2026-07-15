import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type GuestVisit = {
  id: string;
  visited_at: string;
  visitor:
    | {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        last_seen: string | null;
      }
    | {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        last_seen: string | null;
      }[]
    | null;
};

function oneVisitor(visit: GuestVisit) {
  if (!visit.visitor) return null;
  return Array.isArray(visit.visitor) ? visit.visitor[0] ?? null : visit.visitor;
}

export default async function GuestsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/guests");

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await (supabase as any)
    .from("profile_visits")
    .select(
      "id, visited_at, visitor:profiles!profile_visits_visitor_id_fkey(id, username, display_name, avatar_url, last_seen)"
    )
    .eq("profile_id", auth.user.id)
    .gte("visited_at", twentyFourHoursAgo)
    .order("visited_at", { ascending: false })
    .limit(100);

  // One row per visitor is guaranteed by DB unique index; still dedupe defensively.
  const seen = new Set<string>();
  const visits = ((data ?? []) as GuestVisit[])
    .map((visit) => ({ visit, visitor: oneVisitor(visit) }))
    .filter(({ visitor }) => {
      if (!visitor?.id) return false;
      if (seen.has(visitor.id)) return false;
      seen.add(visitor.id);
      return true;
    });

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-100">
            Гости
          </h1>
          <p className="text-sm text-slate-500">
            Кто открывал вашу анкету за последние 24 часа
            {visits.length > 0 ? ` · ${visits.length}` : ""}
          </p>
        </div>

        <div className="space-y-2">
          {visits.length ? (
            visits.map(({ visit, visitor }) => (
              <Link
                key={visit.id}
                href={`/profile/${visitor!.id}`}
                className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/55 p-3 transition-colors hover:border-gold/30"
              >
                <Avatar
                  src={visitor!.avatar_url}
                  name={visitor!.display_name ?? visitor!.username}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-warm-100">
                    {visitor!.display_name ?? visitor!.username}
                  </p>
                  <p className="text-xs text-slate-500">@{visitor!.username}</p>
                </div>
                <div className="text-right">
                  <time className="block text-xs text-slate-400">
                    {timeAgo(visit.visited_at)}
                  </time>
                  <time className="block text-[10px] text-slate-600">
                    {new Date(visit.visited_at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-gold/15 p-8 text-center text-sm text-slate-500">
              За последние 24 часа гостей не было
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
