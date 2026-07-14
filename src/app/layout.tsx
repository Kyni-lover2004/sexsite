import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { supabaseConfigured } from "@/lib/supabase/server";
import { SetupGuide } from "@/components/SetupGuide";
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
    default: "Nebula — обсуждения, знакомства, защищённый чат",
    template: "%s · Nebula",
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
    const stored = localStorage.getItem("nebula-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

import { PresenceTracker } from "@/components/auth/PresenceTracker";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Показываем гайд по настройке, если Supabase не подключён
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
        {children}
        <PresenceTracker />
      </body>
    </html>
  );
}
