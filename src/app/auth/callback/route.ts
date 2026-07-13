import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback — handles the code exchange from OAuth (Google, Telegram)
 * and magic link flows. Redirects the user back to the app after confirming
 * their session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If we got here something went wrong — redirect to login with an error.
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
