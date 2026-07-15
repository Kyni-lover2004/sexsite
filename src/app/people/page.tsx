import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PeopleGrid } from "@/components/people/PeopleGrid";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const PEOPLE_SELECT =
  "id, username, display_name, avatar_url, status, bio, interests, dating_goal, dating_goals, country, region, city, birth_date, gender, available_for_chat, last_seen, role, premium_until, looking_for, created_at";

export default async function PeoplePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  let query = (supabase as any)
    .from("profiles")
    .select(PEOPLE_SELECT)
    .order("last_seen", { ascending: false })
    .limit(60);

  if (auth.user) {
    query = query.neq("id", auth.user.id);
  }

  const { data } = await query;

  return (
    <AppShell>
      <PeopleGrid
        currentUserId={auth.user?.id ?? null}
        initialUsers={(data ?? []) as Profile[]}
      />
    </AppShell>
  );
}
