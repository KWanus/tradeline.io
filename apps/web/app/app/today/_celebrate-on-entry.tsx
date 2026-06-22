"use client";

import { useEffect, useState } from "react";
import { INTENT_LABEL, type ReplyIntent } from "@/lib/replies";

const SEEN_KEY = "tradeline.last_celebrated_reply.v1";

/**
 * Fires a one-time celebratory toast the first time the operator opens Today
 * after a new warm reply lands. Persists the last-celebrated timestamp so it
 * doesn't re-fire on every refresh. Quiet for polite passes / unsubscribes —
 * we only celebrate inbound worth celebrating.
 */
export function CelebrateOnEntry({
  lastReplyAt,
  lastReplyIntent,
}: {
  lastReplyAt?: string;
  lastReplyIntent?: ReplyIntent;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!lastReplyAt) return;
    const worthCelebrating =
      lastReplyIntent === "interested" ||
      lastReplyIntent === "has_tape" ||
      lastReplyIntent === "wants_info";
    if (!worthCelebrating) return;

    let lastSeen = "";
    try {
      lastSeen = window.localStorage.getItem(SEEN_KEY) || "";
    } catch {}

    if (lastReplyAt <= lastSeen) return;

    setShow(true);
    try {
      window.localStorage.setItem(SEEN_KEY, lastReplyAt);
    } catch {}

    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [lastReplyAt, lastReplyIntent]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] px-4 py-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] animate-row-glow"
    >
      <div className="flex items-start gap-3">
        <span className="text-[20px] leading-none">🎉</span>
        <div>
          <div className="text-[14px] font-semibold text-[color:var(--color-success)]">
            A broker replied —{" "}
            {lastReplyIntent ? INTENT_LABEL[lastReplyIntent].toLowerCase() : "inbound"}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            It&rsquo;s at the top of your inbox below. Warm threads close deals —
            work it now.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="ml-1 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
