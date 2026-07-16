import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";

import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  ...noIndexMetadata,
  title: "Админ-панель",
};

export default async function AdminPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  // Independent datasets load in parallel (was sequential waterfall).
  const [
    { data: users },
    { data: topics },
    { data: supportTickets },
    { data: conversations },
    contentReportsRes,
    profileReportsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, role, is_banned, banned_until, ban_reason, premium_until, created_at, last_seen, city, gender"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("topics")
      .select(
        "id, author_id, title, body, status, type, created_at, view_count, like_count, comment_count, author:profiles!topics_author_id_fkey(id, username, display_name, avatar_url)"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    (supabase as any)
      .from("support_tickets")
      .select("id, user_id, subject, status, created_at, updated_at, closed_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    (supabase as any)
      .from("conversations")
      .select("id, user_a, user_b, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    (supabase as any)
      .from("content_reports")
      .select(
        `id, reporter_id, topic_id, comment_id, reason, reason_code, details, status, created_at,
         reporter:profiles!content_reports_reporter_id_fkey(id, username, display_name, avatar_url),
         topic:topics!content_reports_topic_id_fkey(id, title, author_id, body),
         comment:comments!content_reports_comment_id_fkey(id, body, topic_id)`
      )
      .order("created_at", { ascending: false })
      .limit(100),
    (supabase as any)
      .from("profile_reports")
      .select(
        `id, reporter_id, reported_user_id, reason_code, reason_label, details, status, created_at,
         reporter:profiles!profile_reports_reporter_id_fkey(id, username, display_name, avatar_url),
         reported:profiles!profile_reports_reported_user_id_fkey(id, username, display_name, avatar_url)`
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const contentReports = (contentReportsRes.data ?? []).map((r: any) => ({
    ...r,
    reporter: Array.isArray(r.reporter) ? r.reporter[0] ?? null : r.reporter,
    topic: Array.isArray(r.topic) ? r.topic[0] ?? null : r.topic,
    comment: Array.isArray(r.comment) ? r.comment[0] ?? null : r.comment,
  }));
  const profileReports = (profileReportsRes.data ?? []).map((r: any) => ({
    ...r,
    reporter: Array.isArray(r.reporter) ? r.reporter[0] ?? null : r.reporter,
    reported: Array.isArray(r.reported) ? r.reported[0] ?? null : r.reported,
  }));

  const ticketIds = (supportTickets ?? []).map((ticket: any) => ticket.id);
  const { data: supportMessages } =
    ticketIds.length > 0
      ? await (supabase as any)
          .from("support_messages")
          .select(
            "id, ticket_id, sender_id, is_admin, body, attachments, created_at"
          )
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const usersById = new Map(
    ((users ?? []) as any[]).map((u) => [u.id, u])
  );
  const messagesByTicket = new Map<string, any[]>();
  for (const message of supportMessages ?? []) {
    const list = messagesByTicket.get(message.ticket_id) ?? [];
    list.push(message);
    messagesByTicket.set(message.ticket_id, list);
  }

  const supportWithMessages = (supportTickets ?? []).map((ticket: any) => ({
    ...ticket,
    user: usersById.get(ticket.user_id) ?? null,
    messages: messagesByTicket.get(ticket.id) ?? [],
  }));

  const conversationsWithUsers = (conversations ?? []).map((c: any) => ({
    ...c,
    user_a_profile: usersById.get(c.user_a) ?? null,
    user_b_profile: usersById.get(c.user_b) ?? null,
  }));

  return (
    <AppShell>
      <AdminPanel
        currentUserId={auth.user!.id}
        users={(users ?? []) as any}
        topics={(topics ?? []) as any}
        supportTickets={supportWithMessages as any}
        conversations={conversationsWithUsers}
        contentReports={contentReports}
        profileReports={profileReports}
      />
    </AppShell>
  );
}
