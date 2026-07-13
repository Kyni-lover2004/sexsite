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
  themeColor: "#030304",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Показываем гайд по настройке, если Supabase не подключён
  if (!supabaseConfigured) {
    return (
      <html lang="ru" className={`${inter.variable} ${spaceGrotesk.variable} dark`} suppressHydrationWarning>
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
      <body className="font-sans">{children}</body>
    </html>
  );
}
