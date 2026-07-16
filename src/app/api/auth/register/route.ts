import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Register with email+password and mark email confirmed immediately
 * (no verification mail). Uses service role — requires SUPABASE_SERVICE_ROLE_KEY.
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

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Пароль не короче 6 символов" },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "На сервере не задан SUPABASE_SERVICE_ROLE_KEY — добавьте в .env / Vercel.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message || "";
    if (/already|registered|exists|duplicate/i.test(msg)) {
      // User exists — try force-confirm so they can log in if stuck unconfirmed
      try {
        const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = listed.data?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (existing && !existing.email_confirmed_at) {
          await admin.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            password,
          });
          return NextResponse.json({ ok: true, recovered: true });
        }
      } catch {
        /* fall through */
      }
      return NextResponse.json(
        { error: "Этот email уже зарегистрирован. Войдите." },
        { status: 409 }
      );
    }
    if (/signups? are disabled|email signup/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Регистрация отключена в Supabase Auth. Включите Email provider и Sign ups.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "Не удалось создать пользователя" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
