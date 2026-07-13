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

  return (
    <AppShell>
      {profile ? (
        <ProfileView profile={profile as any} isOwn />
      ) : (
        <p className="text-slate-400">Профиль не найден</p>
      )}
    </AppShell>
  );
}
