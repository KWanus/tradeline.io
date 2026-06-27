"use client";

import Link from "next/link";

/**
 * Top-bar notification affordance. There's no server-pushed notification feed
 * in this build, so it's a quiet entry point to the inbox rather than a live
 * unread counter (which would have to invent a count). Links to the reply inbox.
 */
export function NotificationBell() {
  return (
    <Link
      href="/app/inbox"
      title="Inbox"
      aria-label="Inbox"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
    >
      <span aria-hidden className="text-[14px]">
        ◔
      </span>
    </Link>
  );
}
