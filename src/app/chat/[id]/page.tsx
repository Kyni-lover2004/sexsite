import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateConversation } from "@/lib/data/messages";
import { AppShell } from "@/components/layout/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Database } from "@/types/database";

interface Props {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: Props) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/chat/${params.id}`);

  const userId = auth.user.id;

  // Try to find conversation by id directly
  const { data: convRow, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (convError) {
    console.error("Error fetching conversation in chat/[id]/page:", convError);
  }

  const conversation = convRow as Database["public"]["Tables"]["conversations"]["Row"] | null;

  // If not found, treat params.id as the other user's ID
  if (!conversation) {
    let targetConvId: string | null = null;
    let limitReached = false;

    try {
      targetConvId = await getOrCreateConversation(userId, params.id);
    } catch (err: any) {
      if (err.message === "LIMIT_REACHED") {
        limitReached = true;
      } else {
        console.error("Error creating conversation:", err);
      }
    }

    if (limitReached) {
      redirect("/premium?reason=limit");
    }

    if (targetConvId) {
      redirect(`/chat/${targetConvId}`);
    }

    notFound();
  }

  // Verify current user is a participant
  const isParticipant =
    conversation.user_a === userId || conversation.user_b === userId;
  if (!isParticipant) {
    console.error("Access denied: User is not a participant in this conversation.", { userId, convUserA: conversation.user_a, convUserB: conversation.user_b });
    notFound();
  }

  const otherUserId =
    conversation.user_a === userId ? conversation.user_b : conversation.user_a;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, last_seen, premium_until")
    .eq("id", otherUserId)
    .single();

  const otherProfile = profileRow as Database["public"]["Tables"]["profiles"]["Row"] | null;

  if (profileError || !otherProfile) {
    console.error("Error fetching other participant profile:", { otherUserId, profileError });
    notFound();
  }

  return (
    <AppShell noPadding>
      <ChatWindow
        conversationId={conversation.id}
        currentUserId={userId}
        otherUserId={otherUserId}
        otherUser={{
          id: otherProfile.id,
          username: otherProfile.username,
          display_name: otherProfile.display_name,
          avatar_url: otherProfile.avatar_url,
          last_seen: otherProfile.last_seen,
          premium_until: (otherProfile as any).premium_until,
        }}
      />
    </AppShell>
  );
}
