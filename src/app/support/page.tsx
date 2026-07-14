import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SupportCenter } from "@/components/support/SupportCenter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Поддержка",
};

export default async function SupportPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/support");

  const { data: tickets } = await (supabase as any)
    .from("support_tickets")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  const ticketIds = (tickets ?? []).map((ticket: any) => ticket.id);
  const { data: messages } =
    ticketIds.length > 0
      ? await (supabase as any)
          .from("support_messages")
          .select("*")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const ticketsWithMessages = (tickets ?? []).map((ticket: any) => ({
    ...ticket,
    messages: (messages ?? []).filter(
      (message: any) => message.ticket_id === ticket.id
    ),
  }));

  return (
    <AppShell>
      <SupportCenter
        currentUserId={auth.user.id}
        tickets={ticketsWithMessages}
      />
    </AppShell>
  );
}
