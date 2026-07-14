"use client";

import { motion } from "framer-motion";
import {
  Crown,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  Star,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

interface PremiumViewProps {
  isPremium: boolean;
}

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
    icon: EyeOff,
    title: "Режим невидимки",
    description: "Скрывайте свой онлайн-статус от других пользователей",
  },
  {
    icon: Search,
    title: "Расширенные фильтры",
    description: "Ищите людей по интересам, тегам и расширенным критериям",
  },
  {
    icon: Star,
    title: "Приоритет в поиске",
    description: "Ваш профиль отображается выше в результатах поиска",
  },
  {
    icon: Crown,
    title: "Премиум-значок",
    description: "Золотой значок и уникальная рамка аватара",
  },
  {
    icon: Sparkles,
    title: "Эксклюзивные темы",
    description: "Уникальные темы оформления профиля и чата",
  },
  {
    icon: Zap,
    title: "Без ограничений",
    description: "Отправляйте неограниченное количество сообщений и медиа",
  },
];

export function PremiumView({ isPremium }: PremiumViewProps) {
  return (
    <div>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gold-gradient shadow-glow-gold"
        >
          <Crown size={32} className="text-base-950" />
        </motion.div>
        <h1 className="font-display text-3xl font-bold text-gradient-gold">
          Nebula Premium
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Разблокируйте все возможности платформы
        </p>
      </motion.div>

      {/* Current status */}
      {isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <GlassCard premium className="flex items-center gap-3 p-4">
            <CheckCircle2 size={20} className="text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">Премиум активен</p>
              <p className="text-xs text-slate-500">
                Спасибо за поддержку проекта!
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Features grid */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <GlassCard interactive className="flex items-start gap-3 p-4 h-full">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-amber-500/10">
                <feature.icon size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-white">{feature.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {feature.description}
                </p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Pricing cards */}
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
              className={`relative p-5 text-center ${
                plan.popular ? "ring-1 ring-amber-500/30" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-gradient px-3 py-0.5 text-[10px] font-bold text-base-950 shadow-glow-gold">
                  ПОПУЛЯРНЫЙ
                </span>
              )}
              {plan.badge && (
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
                    "Оплата будет доступна в следующей версии. Следите за обновлениями!"
                  );
                }}
              >
                {isPremium ? "Продлить" : "Купить"}
              </Button>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center text-xs text-slate-600"
      >
        Оплата обрабатывается через защищённый шлюз. Подписка продлевается
        автоматически. Отменить можно в любой момент.
      </motion.p>
    </div>
  );
}
