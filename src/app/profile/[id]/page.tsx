import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";

interface Props {
  params: { id: string };
}

export default async function UserProfilePage({ params }: Props) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!profile) notFound();

  if (auth.user && auth.user.id !== params.id) {
    await (supabase as any).from("profile_visits").upsert({
      profile_id: params.id,
      visitor_id: auth.user.id,
      visited_at: new Date().toISOString()
    }, {
      onConflict: "profile_id,visitor_id"
    });
  }

  const { data: photos } = await (supabase as any)
    .from("profile_photos")
    .select("*")
    .eq("user_id", params.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const isPremium =
    profile.premium_until && new Date(profile.premium_until) > new Date();

  return (
    <AppShell>
      <ProfileView
        profile={profile as any}
        photos={(photos ?? []) as any}
        isOwn={auth.user?.id === params.id}
        isPremium={isPremium}
      />
    </AppShell>
  );
}
