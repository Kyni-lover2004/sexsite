import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PeopleGrid } from "@/components/people/PeopleGrid";

export default async function PeoplePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <AppShell>
      <PeopleGrid currentUserId={auth.user?.id ?? null} />
    </AppShell>
  );
}
