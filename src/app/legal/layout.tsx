import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Правовая информация",
  robots: { index: true, follow: true },
};

/** Legal docs are public (no login). AgeGate skips /legal/* so texts are readable. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
