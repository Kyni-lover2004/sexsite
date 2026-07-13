import { Database, Key, ExternalLink, Copy, Sparkles } from "lucide-react";

export function SetupGuide() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 overflow-hidden">
      {/* Floating orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/5 h-60 w-60 rounded-full bg-accent/[0.06] blur-[100px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-gold/[0.04] blur-[80px] animate-float-slow" />
      </div>

      <div className="relative z-10 w-full max-w-lg glass-premium rounded-2xl p-8 shadow-glow-accent">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent-gradient text-2xl font-bold text-white shadow-glow-accent animate-glow-breathe">
            N
          </span>
          <h1 className="font-display text-xl font-bold text-gradient">
            Nebula
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Для запуска нужно подключить Supabase
          </p>
        </div>

        <div className="space-y-5">
          <Step
            number={1}
            icon={<Database size={18} />}
            title="Создай проект Supabase"
          >
            Перейди на{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              className="text-accent-soft hover:underline"
            >
              supabase.com
            </a>
            , нажми <strong>New project</strong>, укажи имя и пароль БД.
          </Step>

          <Step
            number={2}
            icon={<Key size={18} />}
            title="Скопируй ключи"
          >
            В дашборде открой{" "}
            <strong>Project Settings → API</strong>. Скопируй{" "}
            <strong>Project URL</strong> и <strong>anon public key</strong>.
          </Step>

          <Step
            number={3}
            icon={<ExternalLink size={18} />}
            title="Настрой .env.local"
          >
            Создай в корне проекта файл <code>.env.local</code>:
          </Step>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-base-950/80">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
            <span className="text-xs text-slate-600">.env.local</span>
          </div>
          <pre className="overflow-x-auto p-4 text-xs text-slate-400">
            <code>{`NEXT_PUBLIC_SUPABASE_URL=https://твой-реф.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...`}</code>
          </pre>
        </div>

        <Step
          number={4}
          icon={<Copy size={18} />}
          title="Примени схему БД"
        >
          Открой в Supabase <strong>SQL Editor</strong>, вставь содержимое{" "}
          <code>supabase/schema.sql</code> и выполни.
        </Step>

        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
          После этого перезапусти сервер:
          <code className="ml-2 rounded bg-base-800 px-2 py-0.5 text-accent-soft">
            npm run dev
          </code>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-soft shadow-[0_0_8px_rgba(225,29,120,0.15)]">
        {number}
      </span>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-white">
          {icon}
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {children}
        </p>
      </div>
    </div>
  );
}
