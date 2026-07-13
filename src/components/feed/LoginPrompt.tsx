"use client";

import { motion } from "framer-motion";
import { Lock, LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export function LoginPrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <GlassCard className="border border-accent/20 bg-accent/[0.03] p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10">
            <Lock size={18} className="text-accent-soft" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">
              Обсуждения доступны только авторизованным пользователям
            </p>
            <p className="text-xs text-slate-500">
              Войдите или зарегистрируйтесь, чтобы читать и создавать темы
            </p>
          </div>
          <Link href="/login">
            <Button size="sm">
              <LogIn size={14} />
              Войти
            </Button>
          </Link>
        </div>
      </GlassCard>
    </motion.div>
  );
}
