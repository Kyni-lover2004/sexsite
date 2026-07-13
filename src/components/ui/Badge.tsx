import { cn } from "@/lib/utils";

type BadgeTone = "accent" | "gold" | "emerald" | "neutral";

const tones: Record<BadgeTone, string> = {
  accent: "bg-accent/10 text-accent-soft border-accent/25 hover:border-accent/50 hover:shadow-[0_0_12px_rgba(225,29,120,0.15)]",
  gold: "bg-gold/10 text-gold-soft border-gold/25 hover:border-gold/50 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]",
  emerald: "bg-emerald-glow/10 text-emerald-glow border-emerald-glow/25",
  neutral: "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:border-white/20",
};

/** Small count / status badge. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-xs font-medium transition-all duration-200",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Interactive tag chip (used for interests / topic tags). */
export function Tag({
  label,
  active = false,
  onClick,
  className,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200",
        active
          ? "border-accent/40 bg-accent/15 text-accent-soft shadow-[0_0_12px_rgba(225,29,120,0.15)]"
          : "border-white/[0.08] bg-white/[0.04] text-slate-400",
        onClick && "hover:border-accent/40 hover:text-accent-soft hover:bg-accent/10",
        className
      )}
    >
      #{label}
    </Comp>
  );
}
