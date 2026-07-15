import { Feed } from "@/components/feed/Feed";
import { HeroLanding } from "@/components/landing/HeroLanding";
import { AppShell } from "@/components/layout/AppShell";
import {
  getNearbyPeople,
  getTopics,
  getViewerInterestTags,
} from "@/lib/data/topics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const isLoggedIn = !!auth.user;

  if (!isLoggedIn) {
    return <HeroLanding />;
  }

  const userId = auth.user.id;
  const [initialTopics, initialPeople, interestTags] = await Promise.all([
    getTopics("new", undefined, userId),
    getNearbyPeople(userId, 12),
    getViewerInterestTags(userId),
  ]);

  return (
    <AppShell>
      <Feed
        initialTopics={initialTopics}
        initialPeople={initialPeople}
        interestTags={interestTags}
        currentUserId={userId}
      />
    </AppShell>
  );
}
