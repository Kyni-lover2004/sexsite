import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getComments } from "@/lib/data/comments";
import { AppShell } from "@/components/layout/AppShell";
import { TopicDetail } from "@/components/feed/TopicDetail";

interface Props {
  params: { id: string };
}

export default async function TopicPage({ params }: Props) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: raw } = await supabase
    .from("topics")
    .select(
      `*, author:profiles!topics_author_id_fkey(id,username,display_name,avatar_url,last_seen,premium_until)`
    )
    .eq("id", params.id)
    .single();

  const topic = raw as any;
  if (!topic) notFound();

  const comments = await getComments(params.id);

  (supabase as any).rpc("increment_view_count", { topic_id: params.id }).then();

  const author = Array.isArray(topic.author) ? topic.author[0] ?? null : topic.author;
  const typed = { ...topic, author };

  return (
    <AppShell>
      <TopicDetail
        topic={typed}
        initialComments={comments}
        currentUserId={auth.user?.id ?? null}
      />
    </AppShell>
  );
}
