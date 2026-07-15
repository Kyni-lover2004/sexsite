import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { NotificationsPageClient } from "@/components/layout/NotificationsPageClient";
import type { AppNotification } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/notifications");

  const { data, error } = await (supabase as any)
    .from("notifications")
    .select(
      `id, user_id, type, title, body, link, actor_id, meta, read_at, created_at,
       actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)`
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const items: AppNotification[] = error
    ? []
    : (data ?? []).map((row: any) => ({
        ...row,
        actor: Array.isArray(row.actor) ? row.actor[0] ?? null : row.actor,
      }));

  // Opening the page marks all as read
  if (!error) {
    await (supabase as any).rpc("mark_notifications_read");
  }

  return (
    <AppShell>
      <NotificationsPageClient initialItems={items} loadError={!!error} />
    </AppShell>
  );
}
