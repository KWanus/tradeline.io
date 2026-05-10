"use client";

import { useIsWatchlisted } from "@/lib/bank-state";

export function WatchlistStar({ ticker, size = "lg" }: { ticker: string; size?: "sm" | "lg" }) {
  const [flagged, toggle] = useIsWatchlisted(ticker);
  const dims = size === "sm" ? "text-[16px]" : "text-[20px]";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      title={flagged ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={flagged ? "Remove from watchlist" : "Add to watchlist"}
      className={`${dims} ${
        flagged
          ? "text-[color:var(--color-accent)]"
          : "text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)]"
      } transition leading-none`}
    >
      {flagged ? "★" : "☆"}
    </button>
  );
}
