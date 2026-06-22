"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { unreadReplyCount } from "@/lib/replies";

/**
 * Notification bell — a persistent affordance for unread inbound. Reads the
 * unacknowledged reply count from the local mirror and badges the bell so warm
 * inbound is visible from any /app page, not just Today. Updates on the
 * `storage` event so acknowledging a reply in one tab clears it in another.
 */
export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const refresh = () => setCount(unreadReplyCount());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const has = hydrated && count > 0;

  return (
    <Link
      href="/app/today"
      title={has ? `${count} unread repl${count === 1 ? "y" : "ies"}` : "No new replies"}
      aria-label={has ? `${count} unread replies` : "Notifications"}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)] transition"
    >
      <span className="text-[15px] leading-none" aria-hidden>
        🔔
      </span>
      {has && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[color:var(--color-accent)] text-[#0a0c14] text-[10px] font-mono font-semibold flex items-center justify-center"
          style={{ lineHeight: 1 }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
