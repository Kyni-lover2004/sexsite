"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Adds an accent glow on hover. */
  interactive?: boolean;
  /** Uses premium gradient border. */
  premium?: boolean;
}

/**
 * Frosted-glass surface with gradient border accent.
 * Premium variant adds a pink→gold gradient border.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = false, premium = false, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "relative rounded-2xl backdrop-blur-xl",
        "bg-base-800/50 border border-white/[0.06]",
        "shadow-glass shadow-inner-glow",
        premium && "glass-premium",
        interactive && [
          "transition-all duration-300",
          "hover:border-accent/30 hover:shadow-glow-accent",
          "hover:bg-base-800/60",
          "hover:-translate-y-0.5",
        ],
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = "GlassCard";
