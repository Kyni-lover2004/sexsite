import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";

export default async function MyProfilePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  const { data: photos } = await (supabase as any)
    .from("profile_photos")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const { count: friendsCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .or(`requester_id.eq.${auth.user.id},addressee_id.eq.${auth.user.id}`)
    .eq("status", "accepted");

  const { data: albums } = await (supabase as any)
    .from("profile_albums")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  const isPremium =
    profile?.premium_until && new Date(profile.premium_until) > new Date();

  return (
    <AppShell>
      {profile ? (
        <ProfileView
          profile={profile as any}
          photos={(photos ?? []) as any}
          albums={(albums ?? []) as any}
          friendsCount={friendsCount || 0}
          isOwn
          isPremium={isPremium}
        />
      ) : (
        <p className="text-slate-400">Профиль не найден</p>
      )}
    </AppShell>
  );
}
