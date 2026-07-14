import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PremiumView } from "@/components/premium/PremiumView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nebula Premium",
};

export default async function PremiumPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/premium");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, premium_until")
    .eq("id", auth.user.id)
    .single();

  const isPremium =
    profile?.premium_until &&
    new Date((profile as any).premium_until) > new Date();

  return (
    <AppShell>
      <Suspense fallback={<div className="text-slate-500">Загрузка...</div>}>
        <PremiumView isPremium={!!isPremium} />
      </Suspense>
    </AppShell>
  );
}
