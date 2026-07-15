import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CreateTopicForm } from "@/components/feed/CreateTopicForm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Новая тема · Desire Privé",
};

export default async function NewTopicPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) redirect("/login?next=/topic/new");

  // Получаем роль пользователя на сервере
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  return (
    <AppShell>
      <CreateTopicForm isAdmin={isAdmin} />
    </AppShell>
  );
}
