import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Outer box size in px (default 40). */
  size?: number;
  className?: string;
  /** Slightly stronger gold glow for dark headers. */
  glow?: boolean;
  priority?: boolean;
};

/**
 * Official Desire Privé mark — luxury cameo private-club emblem.
 */
export function BrandLogo({
  size = 40,
  className,
  glow = true,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/35 bg-base-950 ring-1 ring-gold/15",
        glow && "shadow-glow-gold",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand-logo.jpg"
        alt="Desire Privé"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full scale-110 object-cover object-center"
      />
    </span>
  );
}
