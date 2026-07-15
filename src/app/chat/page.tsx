import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/data/messages";
import { AppShell } from "@/components/layout/AppShell";
import { ConversationList } from "@/components/chat/ConversationList";
import { noIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = noIndexMetadata;

export default async function ChatInboxPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/chat");

  const conversations = await getConversations(auth.user.id);

  return (
    <AppShell>
      <ConversationList
        conversations={conversations}
        currentUserId={auth.user.id}
      />
    </AppShell>
  );
}
