import { Feed } from "@/components/feed/Feed";
import { HeroLanding } from "@/components/landing/HeroLanding";
import { AppShell } from "@/components/layout/AppShell";
import { getTopics } from "@/lib/data/topics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const isLoggedIn = !!auth.user;

  if (!isLoggedIn) {
    return <HeroLanding />;
  }

  const initialTopics = await getTopics("new", undefined, auth.user?.id);

  return (
    <AppShell>
      <Feed initialTopics={initialTopics} currentUserId={auth.user?.id ?? null} />
    </AppShell>
  );
}
