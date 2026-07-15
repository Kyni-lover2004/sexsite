import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GuestsList } from "@/components/guests/GuestsList";
import { createClient } from "@/lib/supabase/server";
import {
  getGuestsForUser,
  markGuestsSeen,
} from "@/lib/data/guests";

import { noIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = noIndexMetadata;

export default async function GuestsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/guests");

  const guests = await getGuestsForUser(auth.user.id);

  // Opening the page clears the "new guests" badge in the nav.
  await markGuestsSeen();

  const newCount = guests.filter((g) => g.isNew).length;
  const mutualCount = guests.filter((g) => g.isMutual).length;

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-100">
            Гости
          </h1>
          <p className="text-sm text-slate-500">
            Кто открывал вашу анкету за последние 24 часа
            {guests.length > 0 ? ` · ${guests.length}` : ""}
          </p>
          {guests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {newCount > 0 && (
                <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-gold-soft">
                  {newCount}{" "}
                  {newCount === 1
                    ? "новый"
                    : newCount < 5
                      ? "новых"
                      : "новых"}
                </span>
              )}
              {mutualCount > 0 && (
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-rose-300">
                  {mutualCount} взаимных
                </span>
              )}
            </div>
          )}
        </div>

        <GuestsList initialGuests={guests} />
      </div>
    </AppShell>
  );
}
