import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SwipeExperience } from "@/components/people/SwipeExperience";
import {
  getReceivedLikesCount,
  getSwipeViewerMeta,
} from "@/lib/data/swipes";
import { noIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Свайпы · Desire Privé",
  ...noIndexMetadata,
};

export default async function SwipePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/swipe");

  const [meta, likesCount] = await Promise.all([
    getSwipeViewerMeta(auth.user.id),
    getReceivedLikesCount(auth.user.id),
  ]);

  const initialTab = searchParams?.tab === "likes" ? "likes" : "deck";

  return (
    <AppShell>
      <SwipeExperience
        currentUserId={auth.user.id}
        isPremium={meta.isPremium || meta.isAdmin}
        viewerCity={meta.city}
        viewerCountry={meta.country}
        initialTab={initialTab}
        initialLikesCount={likesCount}
      />
    </AppShell>
  );
}
