import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PeopleGrid } from "@/components/people/PeopleGrid";
import {
  getViewerLocation,
  searchPeople,
  type PeopleCard,
} from "@/lib/data/people";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const [initialUsers, location] = await Promise.all([
    searchPeople(userId, { tab: "nearby", limit: 48 }),
    getViewerLocation(userId),
  ]);

  return (
    <AppShell>
      <PeopleGrid
        currentUserId={userId}
        initialUsers={initialUsers as PeopleCard[]}
        viewerCity={location.city}
        viewerCountry={location.country}
      />
    </AppShell>
  );
}
