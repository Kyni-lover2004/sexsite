import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";

async function acceptRequest(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await (supabase as any).from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", String(formData.get("id"))).eq("addressee_id", auth.user.id);
  revalidatePath("/friends");
}

export default async function FriendsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/friends");
  const { data } = await (supabase as any).from("friendships").select("id,status,requester_id,addressee_id,requester:profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url),addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url)").or(`requester_id.eq.${auth.user.id},addressee_id.eq.${auth.user.id}`).order("created_at", { ascending: false });
  const pending = (data ?? []).filter((row: any) => row.status === "pending" && row.addressee_id === auth.user!.id);
  const friends = (data ?? []).filter((row: any) => row.status === "accepted").map((row: any) => row.requester_id === auth.user!.id ? row.addressee : row.requester);
  return <AppShell><div className="space-y-6"><div><h1 className="font-display text-2xl font-bold text-warm-100">Мои друзья</h1><p className="text-sm text-slate-500">Заявки и подтверждённые друзья</p></div>{pending.length > 0 && <section className="space-y-2"><h2 className="font-bold text-warm-100">Новые заявки</h2>{pending.map((row: any) => <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-gold/15 bg-base-800/55 p-3"><Avatar src={row.requester.avatar_url} name={row.requester.display_name ?? row.requester.username}/><Link href={`/profile/${row.requester.id}`} className="min-w-0 flex-1"><p className="truncate font-semibold text-warm-100">{row.requester.display_name ?? row.requester.username}</p><p className="text-xs text-slate-500">@{row.requester.username}</p></Link><form action={acceptRequest}><input type="hidden" name="id" value={row.id}/><button className="rounded-xl bg-accent-deep px-3 py-2 text-xs font-semibold text-white">Принять</button></form></div>)}</section>}<section className="grid gap-3 sm:grid-cols-2">{friends.length ? friends.map((friend: any) => <Link key={friend.id} href={`/profile/${friend.id}`} className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/55 p-4 hover:border-gold/30"><Avatar src={friend.avatar_url} name={friend.display_name ?? friend.username}/><div><p className="font-semibold text-warm-100">{friend.display_name ?? friend.username}</p><p className="text-xs text-slate-500">@{friend.username}</p></div></Link>) : <p className="col-span-full rounded-2xl border border-dashed border-gold/15 p-8 text-center text-sm text-slate-500">Список друзей пока пуст</p>}</section></div></AppShell>;
}
