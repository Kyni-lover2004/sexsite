"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger" | "gold";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "border border-gold/30 bg-accent-gradient text-base-950 font-semibold shadow-glow-accent btn-shimmer hover:shadow-glow-accent-lg",
  gold: "border border-gold/40 bg-gold-gradient text-base-950 font-semibold shadow-glow-gold btn-shimmer hover:shadow-glow-gold-lg",
  ghost: "text-slate-300 hover:bg-gold/[0.06] hover:text-warm-100",
  outline:
    "border border-gold/20 bg-base-900/35 text-slate-200 hover:border-gold/45 hover:text-warm-100 hover:shadow-[0_0_24px_rgba(245,213,138,0.1)]",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
}

/** Animated button with micro-interaction on tap (Framer Motion). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium",
        "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-gold/60 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
