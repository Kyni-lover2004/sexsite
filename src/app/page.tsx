import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";
import { LoginPrompt } from "@/components/feed/LoginPrompt";
import { getTopics } from "@/lib/data/topics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const isLoggedIn = !!auth.user;
  const initialTopics = isLoggedIn ? await getTopics("new") : [];

  return (
    <AppShell>
      {!isLoggedIn && <LoginPrompt />}
      <Feed initialTopics={initialTopics} currentUserId={auth.user?.id ?? null} />
    </AppShell>
  );
}
