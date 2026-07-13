import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";
import { getTopics } from "@/lib/data/topics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const initialTopics = await getTopics("new");

  return (
    <AppShell>
      <Feed initialTopics={initialTopics} currentUserId={auth.user?.id ?? null} />
    </AppShell>
  );
}
