import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata = {
  title: "Админ-панель",
};

export default async function AdminPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: topics } = await supabase
    .from("topics")
    .select("*, author:profiles!topics_author_id_fkey(id, username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AppShell>
      <AdminPanel
        currentUserId={auth.user!.id}
        users={(users ?? []) as any}
        topics={(topics ?? []) as any}
      />
    </AppShell>
  );
}
