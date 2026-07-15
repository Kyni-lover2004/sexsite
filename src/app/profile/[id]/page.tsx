import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: Props) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!profile) notFound();

  const { data: photos } = await (supabase as any)
    .from("profile_photos")
    .select("*")
    .eq("user_id", params.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const { count: friendsCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .or(`requester_id.eq.${params.id},addressee_id.eq.${params.id}`)
    .eq("status", "accepted");

  const { data: albums } = await (supabase as any)
    .from("profile_albums")
    .select("*")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false });

  const isPremium =
    profile.premium_until && new Date(profile.premium_until) > new Date();

  return (
    <AppShell>
      <ProfileView
        profile={profile as any}
        photos={(photos ?? []) as any}
        albums={(albums ?? []) as any}
        friendsCount={friendsCount || 0}
        isOwn={auth.user?.id === params.id}
        isPremium={isPremium}
      />
    </AppShell>
  );
}
