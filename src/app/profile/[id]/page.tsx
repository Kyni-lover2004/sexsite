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

  return (
    <AppShell>
      <ProfileView
        profile={profile as any}
        isOwn={auth.user?.id === params.id}
      />
    </AppShell>
  );
}
