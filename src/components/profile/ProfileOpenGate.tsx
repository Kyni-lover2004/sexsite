import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export function ProfileOpenGate({
  limit = 2,
  count = 2,
}: {
  limit?: number;
  count?: number;
}) {
  return (
    <div className="mx-auto max-w-md py-10">
      <GlassCard className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-gold">
          <Lock size={26} />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-gradient">
            Лимит просмотров анкет
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Без Premium можно открыть только{" "}
            <span className="text-warm-100">{limit}</span> чужие анкеты в сутки.
            Сегодня: {count} / {limit}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Друзья и Premium — без ограничений. Счётчик сбрасывается каждый день
            (UTC).
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/premium">
            <Button className="w-full" variant="gold">
              <Crown size={16} />
              Оформить Premium
            </Button>
          </Link>
          <Link href="/people">
            <Button className="w-full" variant="outline">
              Назад к поиску
            </Button>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
