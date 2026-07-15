import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { ProfileOpenGate } from "@/components/profile/ProfileOpenGate";
import { noIndexMetadata } from "@/lib/seo";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

/** Private club — profiles should not be indexed. */
export const metadata = noIndexMetadata;

export default async function UserProfilePage({ params }: Props) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/profile/${params.id}`);

  const isOwn = auth.user.id === params.id;

  // Free users: max 2 foreign profile opens / day (premium & admin unlimited)
  if (!isOwn) {
    const { data: openRes, error: openErr } = await (supabase as any).rpc(
      "record_profile_open",
      { p_profile_id: params.id }
    );
    if (!openErr && openRes && openRes.allowed === false) {
      return (
        <AppShell>
          <ProfileOpenGate
            limit={typeof openRes.limit === "number" ? openRes.limit : 2}
            count={typeof openRes.count === "number" ? openRes.count : 2}
          />
        </AppShell>
      );
    }
  }

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

  const { data: friendsData } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${params.id},addressee_id.eq.${params.id}`)
    .eq("status", "accepted");

  const uniqueFriends = new Set(
    friendsData?.map((f: any) =>
      f.requester_id === params.id ? f.addressee_id : f.requester_id
    )
  );
  const friendsCount = uniqueFriends.size;

  const { data: albums } = await (supabase as any)
    .from("profile_albums")
    .select("*")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false });

  const profileIsPremium =
    !!(profile as any).premium_until &&
    new Date((profile as any).premium_until) > new Date();

  const { data: me } = await supabase
    .from("profiles")
    .select("premium_until, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const viewerIsPremium =
    !!me?.premium_until && new Date(me.premium_until) > new Date();
  const viewerIsAdmin = (me as any)?.role === "admin";

  return (
    <AppShell>
      <ProfileView
        profile={profile as any}
        photos={(photos ?? []) as any}
        albums={(albums ?? []) as any}
        friendsCount={friendsCount || 0}
        isOwn={isOwn}
        isPremium={profileIsPremium}
        viewerIsPremium={viewerIsPremium}
        viewerIsAdmin={viewerIsAdmin}
      />
    </AppShell>
  );
}
