import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";

type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FriendshipRow = {
  id: string;
  status: string;
  requester_id: string;
  addressee_id: string;
  requester: FriendProfile | FriendProfile[] | null;
  addressee: FriendProfile | FriendProfile[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function acceptRequest(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const otherId = String(formData.get("otherId") ?? "");
  if (!otherId) return;

  await (supabase as any).rpc("accept_friendship", { p_other_id: otherId });
  revalidatePath("/friends");
  revalidatePath("/profile");
}

async function declineRequest(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const friendshipId = String(formData.get("id") ?? "");
  if (!friendshipId) return;

  // Soft-decline keeps the pair unique and blocks spam re-requests until removed.
  await (supabase as any)
    .from("friendships")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", auth.user.id)
    .eq("status", "pending");

  revalidatePath("/friends");
}

async function cancelOutgoing(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const otherId = String(formData.get("otherId") ?? "");
  if (!otherId) return;

  await (supabase as any).rpc("remove_friendship", { p_other_id: otherId });
  revalidatePath("/friends");
}

async function removeFriend(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const otherId = String(formData.get("otherId") ?? "");
  if (!otherId) return;

  await (supabase as any).rpc("remove_friendship", { p_other_id: otherId });
  revalidatePath("/friends");
  revalidatePath("/profile");
}

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/friends");

  const me = auth.user.id;

  const { data } = await (supabase as any)
    .from("friendships")
    .select(
      `id, status, requester_id, addressee_id,
       requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
       addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)`
    )
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as FriendshipRow[];

  const incoming = rows
    .filter((row) => row.status === "pending" && row.addressee_id === me)
    .map((row) => ({
      id: row.id,
      other: one(row.requester),
    }))
    .filter((row) => row.other);

  const outgoing = rows
    .filter((row) => row.status === "pending" && row.requester_id === me)
    .map((row) => ({
      id: row.id,
      other: one(row.addressee),
    }))
    .filter((row) => row.other);

  const friendsMap = new Map<string, FriendProfile>();
  for (const row of rows) {
    if (row.status !== "accepted") continue;
    const other =
      row.requester_id === me ? one(row.addressee) : one(row.requester);
    if (other) friendsMap.set(other.id, other);
  }
  const friends = Array.from(friendsMap.values());

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-100">
            Мои друзья
          </h1>
          <p className="text-sm text-slate-500">
            Входящие заявки, исходящие и подтверждённые друзья
          </p>
        </div>

        {incoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold text-warm-100">
              Входящие заявки
              <span className="ml-2 text-sm font-normal text-slate-500">
                {incoming.length}
              </span>
            </h2>
            {incoming.map(({ id, other }) => (
              <div
                key={id}
                className="flex items-center gap-3 rounded-2xl border border-gold/15 bg-base-800/55 p-3"
              >
                <Avatar
                  src={other!.avatar_url}
                  name={other!.display_name ?? other!.username}
                />
                <Link href={`/profile/${other!.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-warm-100">
                    {other!.display_name ?? other!.username}
                  </p>
                  <p className="text-xs text-slate-500">@{other!.username}</p>
                </Link>
                <div className="flex items-center gap-2">
                  <form action={acceptRequest}>
                    <input type="hidden" name="otherId" value={other!.id} />
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      ✓ Принять
                    </button>
                  </form>
                  <form action={declineRequest}>
                    <input type="hidden" name="id" value={id} />
                    <button
                      type="submit"
                      className="rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      ✗ Отклонить
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </section>
        )}

        {outgoing.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold text-warm-100">
              Исходящие заявки
              <span className="ml-2 text-sm font-normal text-slate-500">
                {outgoing.length}
              </span>
            </h2>
            {outgoing.map(({ id, other }) => (
              <div
                key={id}
                className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/45 p-3"
              >
                <Avatar
                  src={other!.avatar_url}
                  name={other!.display_name ?? other!.username}
                />
                <Link href={`/profile/${other!.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-warm-100">
                    {other!.display_name ?? other!.username}
                  </p>
                  <p className="text-xs text-slate-500">Ожидает ответа</p>
                </Link>
                <form action={cancelOutgoing}>
                  <input type="hidden" name="otherId" value={other!.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-gold/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-base-700"
                  >
                    Отменить
                  </button>
                </form>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-bold text-warm-100">
            Друзья
            <span className="ml-2 text-sm font-normal text-slate-500">
              {friends.length}
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.length ? (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/55 p-4"
                >
                  <Link
                    href={`/profile/${friend.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar
                      src={friend.avatar_url}
                      name={friend.display_name ?? friend.username}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-warm-100">
                        {friend.display_name ?? friend.username}
                      </p>
                      <p className="text-xs text-slate-500">
                        @{friend.username}
                      </p>
                    </div>
                  </Link>
                  <form action={removeFriend}>
                    <input type="hidden" name="otherId" value={friend.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-red-500/20 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Удалить
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <p className="col-span-full rounded-2xl border border-dashed border-gold/15 p-8 text-center text-sm text-slate-500">
                Список друзей пока пуст
              </p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
