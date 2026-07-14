import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { SetupGuide } from "@/components/SetupGuide";
import { BannedScreen } from "@/components/auth/BannedScreen";
import { PresenceTracker } from "@/components/auth/PresenceTracker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Desire Privé — обсуждения, знакомства, защищённый чат",
    template: "%s · Desire Privé",
  },
  description:
    "Современная социальная платформа: форум с обсуждениями, знакомства и мессенджер со сквозным шифрованием.",
};

export const viewport: Viewport = {
  themeColor: "#040404",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("desire-prive-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) {
    return (
      <html lang="ru" className={`${inter.variable} ${spaceGrotesk.variable} dark`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="font-sans">
          <SetupGuide />
        </body>
      </html>
    );
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  let activeBan:
    | { banned_until: string | null; ban_reason: string | null }
    | null = null;

  if (auth.user) {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("is_banned, banned_until, ban_reason")
      .eq("id", auth.user.id)
      .maybeSingle();

    const bannedUntil = profile?.banned_until
      ? new Date(profile.banned_until)
      : null;

    if (profile?.is_banned && (!bannedUntil || bannedUntil > new Date())) {
      activeBan = {
        banned_until: profile.banned_until,
        ban_reason: profile.ban_reason,
      };
    }
  }

  return (
    <html
      lang="ru"
      className={`${inter.variable} ${spaceGrotesk.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        {activeBan ? (
          <BannedScreen
            bannedUntil={activeBan.banned_until}
            reason={activeBan.ban_reason}
          />
        ) : (
          <>
            {children}
            <PresenceTracker />
          </>
        )}
      </body>
    </html>
  );
}
