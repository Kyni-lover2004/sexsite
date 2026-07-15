"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Crown,
  Eye,
  Flame,
  Heart,
  Sparkles,
  Star,
  UserRound,
  Zap,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

interface PremiumViewProps {
  isPremium: boolean;
}

/** Prices kept; benefits match current product limits. */
const PLANS = [
  {
    name: "Неделя",
    price: "99 ₽",
    period: "/ неделя",
    popular: false,
  },
  {
    name: "Месяц",
    price: "299 ₽",
    period: "/ месяц",
    popular: true,
  },
  {
    name: "Год",
    price: "1 990 ₽",
    period: "/ год",
    popular: false,
    badge: "Выгодно",
  },
];

const FEATURES = [
  {
    icon: Eye,
    title: "Фото: 100 в сутки",
    description:
      "Обычный аккаунт — 10 открытий чужих фото в день. Premium — 100. Повтор того же фото в этот день не тратит квоту.",
  },
  {
    icon: UserRound,
    title: "Анкеты без лимита",
    description:
      "Без Premium из поиска можно открыть только 2 чужие анкеты в сутки. С Premium — смотрите профили без дневного потолка. Друзья всегда открыты.",
  },
  {
    icon: Heart,
    title: "100 лайков в свайпах",
    description:
      "Бесплатно — 10 лайков в колоде в день. Premium — 100. Пасс по-прежнему бесплатный и не жрёт лимит.",
  },
  {
    icon: Star,
    title: "Суперлайк",
    description:
      "Только Premium (и админы). Выделяет вас золотом у другого человека и поднимает в их «Лайках» наверх.",
  },
  {
    icon: MessageCircle,
    title: "Больше новых диалогов",
    description:
      "Без Premium — до 2 новых чатов в день. Premium снимает дневной лимит на старт переписок.",
  },
  {
    icon: Crown,
    title: "Значок PRO",
    description:
      "Золотой бейдж на анкете — сразу видно, что вы в клубе с расширенным доступом.",
  },
  {
    icon: Flame,
    title: "Свайпы и поиск на максимум",
    description:
      "Больше лайков, больше открытых анкет и фото — быстрее взаимность и живые знакомства.",
  },
  {
    icon: Zap,
    title: "Приоритет внимания",
    description:
      "Суперлайк + PRO-статус помогают не потеряться в потоке: вас заметят раньше, чем обычный интерес.",
  },
];

const FREE_VS_PREMIUM = [
  { label: "Фото / день", free: "10", pro: "100" },
  { label: "Чужие анкеты / день", free: "2", pro: "∞" },
  { label: "Лайки в свайпах / день", free: "10", pro: "100" },
  { label: "Суперлайк", free: "—", pro: "да" },
  { label: "Новые чаты / день", free: "2", pro: "∞" },
  { label: "Значок PRO", free: "—", pro: "да" },
];

function LimitBanners() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  if (reason === "limit") {
    return (
      <Banner
        title="Лимит новых диалогов"
        text="Без Premium можно начать чат только с 2 новыми людьми в сутки. Оформите подписку — и пишите без дневного потолка."
      />
    );
  }
  if (reason === "photo_limit") {
    return (
      <Banner
        title="Лимит просмотра фото"
        text="Без Premium — 10 чужих фото в день, с Premium — 100. Завтра квота обновится; PRO даёт запас уже сегодня."
      />
    );
  }
  if (reason === "profile_limit") {
    return (
      <Banner
        title="Лимит просмотра анкет"
        text="Без Premium можно открыть только 2 чужие анкеты в сутки (кроме друзей). Premium — без этого ограничения."
      />
    );
  }
  if (reason === "swipe_limit") {
    return (
      <Banner
        title="Лимит лайков в свайпах"
        text="Бесплатно — 10 лайков в день. Premium — 100. Пасс не считается. Суперлайк — только с PRO."
      />
    );
  }
  return null;
}

function Banner({ title, text }: { title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <GlassCard className="border-gold/30 bg-gold/10 p-4 shadow-glow-gold">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gold/10 text-gold-soft">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gold-soft">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              {text}
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function PremiumView({ isPremium }: PremiumViewProps) {
  return (
    <div>
      <Suspense fallback={null}>
        <LimitBanners />
      </Suspense>

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center sm:mb-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
          className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gold-gradient shadow-glow-gold sm:mb-4 sm:h-16 sm:w-16"
        >
          <Crown size={32} className="text-white drop-shadow-sm" />
        </motion.div>
        <h1 className="font-display text-2xl font-bold text-gradient-gold sm:text-3xl">
          Desire Privé Premium
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          Больше фото, анкет и лайков в сутки · суперлайк · значок PRO · без
          урезания новых чатов
        </p>
      </motion.div>

      {isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <GlassCard premium className="flex items-center gap-3 p-4">
            <CheckCircle2 size={20} className="text-gold-soft" />
            <div>
              <p className="font-medium text-gold-soft">Премиум активен</p>
              <p className="text-xs text-slate-500">
                Расширенные лимиты и суперлайк уже у вас. Спасибо, что в клубе.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      <GlassCard className="mb-8 overflow-hidden p-0">
        <div className="border-b border-gold/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-warm-100">
            <Sparkles size={16} className="text-gold-soft" />
            Free vs Premium
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Счётчики сбрасываются раз в сутки (UTC)
          </p>
        </div>
        <div className="divide-y divide-gold/5">
          <div className="grid grid-cols-3 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Возможность</span>
            <span className="text-center">Free</span>
            <span className="text-center text-gold-soft">Premium</span>
          </div>
          {FREE_VS_PREMIUM.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-3 items-center gap-2 px-4 py-2.5 text-sm"
            >
              <span className="text-slate-300">{row.label}</span>
              <span className="text-center text-slate-500">{row.free}</span>
              <span className="text-center font-semibold text-gold-soft">
                {row.pro}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <GlassCard interactive className="flex h-full items-start gap-3 p-4">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-gold/10">
                <feature.icon size={18} className="text-gold-soft" />
              </div>
              <div>
                <p className="font-medium text-white">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <h2 className="mb-4 font-display text-lg font-bold text-white">
        Выберите план
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
          >
            <GlassCard
              premium={plan.popular}
              interactive
              className={`relative p-4 text-center sm:p-5 ${
                plan.popular ? "ring-1 ring-gold/30" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-gradient px-3 py-0.5 text-[10px] font-bold text-white shadow-glow-gold dark:[text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">
                  ПОПУЛЯРНЫЙ
                </span>
              )}
              {plan.badge && !plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold text-white">
                  {plan.badge}
                </span>
              )}

              <p className="mt-2 text-sm font-medium text-slate-400">
                {plan.name}
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-white">
                {plan.price}
              </p>
              <p className="text-xs text-slate-500">{plan.period}</p>

              <Button
                variant={plan.popular ? "gold" : "outline"}
                size="md"
                className="mt-4 w-full"
                onClick={() => {
                  alert(
                    "Оплата подключится в следующей версии. Админ уже может выдать Premium вручную."
                  );
                }}
              >
                {isPremium ? "Продлить" : "Купить"}
              </Button>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center text-xs text-slate-600"
      >
        Цены указаны за доступ к расширенным лимитам клуба. Оплата через
        защищённый шлюз появится позже; сейчас Premium выдаёт администратор.
      </motion.p>
    </div>
  );
}
