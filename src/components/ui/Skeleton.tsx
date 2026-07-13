import { cn } from "@/lib/utils";

/**
 * Shimmering skeleton block used for loading states.
 * Uses the accent→gold gradient shimmer.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-white/[0.04]",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:animate-shimmer after:bg-gradient-to-r",
        "after:from-transparent after:via-accent/[0.06] after:to-transparent",
        className
      )}
    />
  );
}

/** A skeleton shaped like a topic card, shown while the feed loads. */
export function TopicCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-base-800/40 p-5">
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
