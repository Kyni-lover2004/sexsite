import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/guests");
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await (supabase as any)
    .from("profile_visits")
    .select("id,visited_at,visitor:profiles!profile_visits_visitor_id_fkey(id,username,display_name,avatar_url,last_seen)")
    .eq("profile_id", auth.user.id)
    .gte("visited_at", twentyFourHoursAgo)
    .order("visited_at", { ascending: false })
    .limit(100);

  return <AppShell><div className="space-y-5"><div><h1 className="font-display text-2xl font-bold text-warm-100">Гости</h1><p className="text-sm text-slate-500">Пользователи, которые открывали вашу анкету</p></div><div className="space-y-2">{data?.length ? data.map((visit: any) => <Link key={visit.id} href={`/profile/${visit.visitor.id}`} className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/55 p-3 transition-colors hover:border-gold/30"><Avatar src={visit.visitor.avatar_url} name={visit.visitor.display_name ?? visit.visitor.username} /><div className="min-w-0 flex-1"><p className="truncate font-semibold text-warm-100">{visit.visitor.display_name ?? visit.visitor.username}</p><p className="text-xs text-slate-500">@{visit.visitor.username}</p></div><time className="text-xs text-slate-500">{new Date(visit.visited_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></Link>) : <p className="rounded-2xl border border-dashed border-gold/15 p-8 text-center text-sm text-slate-500">Гостей пока нет</p>}</div></div></AppShell>;
}
