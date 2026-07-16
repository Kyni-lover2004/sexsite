import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { SiteFooter } from "@/components/legal/SiteFooter";

const NAV = [
  { href: "/legal/rules", label: "Правила" },
  { href: "/legal/terms", label: "Условия" },
  { href: "/legal/privacy", label: "Конфиденциальность" },
  { href: "/legal/offer", label: "Оферта" },
];

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-base-950 text-slate-300">
      <header className="border-b border-gold/10 bg-base-900/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo size={32} />
            <span className="font-display text-sm font-bold text-gradient">
              Desire Privé
            </span>
          </Link>
          <Link
            href="/login"
            className="text-xs text-gold-soft hover:underline"
          >
            Войти
          </Link>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-gold/15 px-3 py-1 text-[11px] text-slate-400 hover:border-gold/30 hover:text-warm-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-amber-400/80">
          18+ · публичный документ
        </p>
        <h1 className="mb-6 font-display text-2xl font-bold text-warm-100 sm:text-3xl">
          {title}
        </h1>
        <div className="legal-prose space-y-4 text-sm leading-relaxed text-slate-400 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-warm-100 [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-slate-300 [&_ul]:space-y-1.5">
          {children}
        </div>
        <p className="mt-10 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-[11px] text-amber-100/70">
          Текст носит информационный характер и не заменяет консультацию юриста.
          Перед коммерческим запуском проверьте формулировки под вашу юрисдикцию
          и модель (в т.ч. 152-ФЗ, если обрабатываете ПДн граждан РФ).
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
