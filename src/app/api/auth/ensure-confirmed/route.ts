import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * If the user exists but email is not confirmed, confirm it (and optionally
 * set password). Used after "Invalid login credentials" when Confirm email
 * was previously ON.
 *
 * Body: { email, password? }
 * - password: if provided and user is unconfirmed, password is updated so login works.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Укажите email" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Нет SUPABASE_SERVICE_ROLE_KEY на сервере" },
      { status: 500 }
    );
  }

  // Paginate a bit — small projects fit in a few pages
  let existing:
    | { id: string; email_confirmed_at?: string | null }
    | undefined;

  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) {
      existing = hit;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!existing) {
    return NextResponse.json({ ok: false, found: false });
  }

  const needsConfirm = !existing.email_confirmed_at;
  if (!needsConfirm && !password) {
    return NextResponse.json({
      ok: true,
      found: true,
      alreadyConfirmed: true,
    });
  }

  const patch: { email_confirm?: boolean; password?: string } = {};
  if (needsConfirm) patch.email_confirm = true;
  // Only set password when repairing unconfirmed accounts (stuck after old signup flow)
  if (needsConfirm && password.length >= 6) {
    patch.password = password;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      ok: true,
      found: true,
      alreadyConfirmed: true,
    });
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(
    existing.id,
    patch
  );
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    repaired: true,
    confirmed: needsConfirm,
  });
}
