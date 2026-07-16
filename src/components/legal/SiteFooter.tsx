import Link from "next/link";

const LINKS = [
  { href: "/legal/rules", label: "Правила 18+" },
  { href: "/legal/terms", label: "Условия" },
  { href: "/legal/privacy", label: "Конфиденциальность" },
  { href: "/legal/offer", label: "Оферта" },
  { href: "/legal", label: "Все документы" },
];

export function SiteFooter({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <footer
      className={`border-t border-gold/10 ${compact ? "py-4" : "py-8"} ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-600">
          © {new Date().getFullYear()} Desire Privé · 18+ · частный клуб
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[11px] text-slate-500 transition-colors hover:text-gold-soft"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
