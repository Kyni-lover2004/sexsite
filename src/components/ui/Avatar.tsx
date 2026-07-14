import { cn, initials, isOnline } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  lastSeen?: string | null;
  showPresence?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const dims: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

/** User avatar with gradient ring, initials fallback and animated online pulse. */
export function Avatar({
  src,
  name,
  lastSeen,
  showPresence = false,
  size = "md",
  className,
}: AvatarProps) {
  const online = isOnline(lastSeen);
  const isLarge = size === "lg" || size === "xl";

  return (
    <div className={cn("relative shrink-0", className)}>
      {/* Gradient ring container */}
      <div
        className={cn(
          "rounded-full p-[2px]",
          "bg-gradient-to-br from-accent via-accent-deep to-gold",
          isLarge && online && "animate-glow-breathe"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-full",
            "bg-base-900 font-semibold text-white",
            dims[size]
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={name ?? "avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-gold-soft dark:text-white">
              {initials(name)}
            </span>
          )}
        </div>
      </div>

      {/* Online indicator with pulse ring */}
      {showPresence && (
        <span className="absolute bottom-0 right-0">
          <span
            className={cn(
              "block h-3 w-3 rounded-full ring-2 ring-base-900",
              online ? "bg-emerald-glow" : "bg-slate-600"
            )}
          />
          {online && (
            <span className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-glow animate-pulse-ring" />
          )}
        </span>
      )}
    </div>
  );
}
