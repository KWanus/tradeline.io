"use client";

import { useEffect } from "react";
import type { ReplyIntent } from "@/lib/replies";

const SEEN_KEY = "tradeline.today.last_celebrated_reply";

/**
 * Fires a one-time celebration when a *new* reply has arrived since the last
 * visit. Quiet by default: with no reply (the current state) it renders nothing
 * and does nothing. Uses the shared `tradeline:celebrate` event so we don't
 * pull in a confetti dependency here.
 */
export function CelebrateOnEntry({
  lastReplyAt,
  lastReplyIntent,
}: {
  lastReplyAt: string | null;
  lastReplyIntent: ReplyIntent | null;
}) {
  useEffect(() => {
    if (!lastReplyAt) return;
    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (seen === lastReplyAt) return; // already celebrated this one
      window.localStorage.setItem(SEEN_KEY, lastReplyAt);
      window.dispatchEvent(
        new CustomEvent("tradeline:celebrate", { detail: { intent: lastReplyIntent } })
      );
    } catch {
      // localStorage unavailable — skip silently.
    }
  }, [lastReplyAt, lastReplyIntent]);

  return null;
}
