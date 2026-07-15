import { cn } from "@/lib/utils";

/**
 * Shimmering skeleton block used for loading states.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-base-700/40 dark:bg-white/[0.04]",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:animate-shimmer after:bg-gradient-to-r",
        "after:from-transparent after:via-gold/[0.12] after:to-transparent",
        "dark:after:via-accent/[0.08]",
        className
      )}
    />
  );
}

/** Topic / feed card placeholder */
export function TopicCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gold/10 bg-base-800/45 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** People discovery card placeholder */
export function PersonCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gold/10 bg-base-800/45 p-4">
      <div className="flex gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

/** Chat inbox row placeholder */
export function ChatRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold/10 bg-base-800/45 p-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-full max-w-[12rem]" />
      </div>
      <Skeleton className="h-3 w-8" />
    </div>
  );
}

/** Generic list of N skeletons */
export function SkeletonList({
  count = 4,
  variant = "topic",
}: {
  count?: number;
  variant?: "topic" | "person" | "chat";
}) {
  const Item =
    variant === "person"
      ? PersonCardSkeleton
      : variant === "chat"
        ? ChatRowSkeleton
        : TopicCardSkeleton;

  return (
    <div
      className={
        variant === "person"
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
          : "space-y-3"
      }
    >
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}
