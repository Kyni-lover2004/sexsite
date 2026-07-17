import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * OAuth / magic / password-recovery callback.
 * Recovery links should use:
 *   redirectTo = {origin}/auth/callback?next=/reset-password
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  let next = safeRedirectPath(searchParams.get("next"), "/");

  // Password recovery → always land on reset form
  if (type === "recovery" || next === "/reset-password") {
    next = "/reset-password";
  }

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Older email templates: token_hash + type
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "recovery" | "signup" | "invite" | "email" | "magiclink",
    });
    if (!error) {
      const dest =
        type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      type === "recovery"
        ? "Ссылка сброса пароля недействительна или истекла"
        : "auth_failed"
    )}`
  );
}
