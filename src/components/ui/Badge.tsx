import { cn } from "@/lib/utils";

type BadgeTone = "accent" | "gold" | "emerald" | "neutral";

const tones: Record<BadgeTone, string> = {
  accent: "bg-gold/10 text-gold-soft border-gold/25 hover:border-gold/50 hover:shadow-[0_0_14px_rgb(var(--gold-glow)/0.15)]",
  gold: "bg-gold/10 text-gold-soft border-gold/25 hover:border-gold/50 hover:shadow-[0_0_14px_rgb(var(--gold-glow)/0.15)]",
  emerald: "bg-emerald-glow/10 text-emerald-glow border-emerald-glow/25",
  neutral: "bg-base-900/55 text-slate-300 border-gold/10 hover:border-gold/25",
};

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
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5",
        "text-xs font-medium transition-all duration-200",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Tag({
  label,
  active = false,
  onClick,
  className,
  showHash = true,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  showHash?: boolean;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200",
        active
          ? "border-gold/45 bg-gold/15 text-gold-soft shadow-[0_0_14px_rgb(var(--gold-glow)/0.14)]"
          : "border-gold/10 bg-base-900/50 text-slate-400",
        onClick && "hover:border-gold/40 hover:text-gold-soft hover:bg-gold/10",
        className
      )}
    >
      <span className="truncate">{showHash ? "#" : ""}{label}</span>
    </Comp>
  );
}
