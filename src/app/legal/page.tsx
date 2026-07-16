import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";

const DOCS = [
  {
    href: "/legal/rules",
    title: "Правила сообщества (18+)",
    desc: "Возраст, поведение, запрещённый контент, жалобы.",
  },
  {
    href: "/legal/terms",
    title: "Условия использования",
    desc: "Доступ к сервису, аккаунт, ответственность, Premium.",
  },
  {
    href: "/legal/privacy",
    title: "Политика конфиденциальности",
    desc: "Какие данные собираем, зачем, E2EE, cookies, 152-ФЗ.",
  },
  {
    href: "/legal/offer",
    title: "Публичная оферта (Premium)",
    desc: "Платные услуги, тарифы, отказ от гарантий «брака в приложении».",
  },
];

export default function LegalIndexPage() {
  return (
    <LegalShell title="Правовые документы">
      <p>
        Desire Privé — закрытый веб-клуб для взрослых. Ниже документы, с
        которыми вы соглашаетесь при регистрации и использовании сервиса.
      </p>
      <ul className="!list-none !ml-0 space-y-3">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block rounded-xl border border-gold/15 bg-base-900/50 p-4 transition-colors hover:border-gold/30"
            >
              <span className="font-medium text-warm-100">{d.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{d.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Контакты поддержки: раздел «Поддержка» в приложении (нужен вход) или
        email, указанный оператором сервиса.
      </p>
    </LegalShell>
  );
}
