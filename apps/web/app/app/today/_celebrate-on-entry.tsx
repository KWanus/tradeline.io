"use client";

import { useEffect, useState } from "react";

import { CelebrationToast, SparkleBurst } from "../_components/celebrate";

/**
 * Fires a one-time celebration when a NEW reply has landed since the operator
 * last visited Today. "New" is judged by comparing the latest reply timestamp
 * against the last one we celebrated (stored locally), so refreshing the page
 * doesn't re-trigger it. Positive intents get a warmer message.
 */

const SEEN_KEY = "tradeline.today_celebrated_reply_ts.v1";

const POSITIVE = new Set(["warm", "has-tape", "wants-info", "tape-detail-request"]);

export function CelebrateOnEntry({
  lastReplyAt,
  lastReplyIntent,
}: {
  lastReplyAt: string | null;
  lastReplyIntent: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!lastReplyAt) return;
    let seen = "";
    try {
      seen = window.localStorage.getItem(SEEN_KEY) || "";
    } catch {}
    if (seen && seen >= lastReplyAt) return; // already celebrated this one

    const positive = lastReplyIntent ? POSITIVE.has(lastReplyIntent) : false;
    setMessage(
      positive
        ? "New reply in — a broker's engaging. Go close it."
        : "New reply landed. Take a look."
    );
    setBurst(positive);

    try {
      window.localStorage.setItem(SEEN_KEY, lastReplyAt);
    } catch {}

    const t = window.setTimeout(() => {
      setMessage(null);
      setBurst(false);
    }, 4200);
    return () => window.clearTimeout(t);
  }, [lastReplyAt, lastReplyIntent]);

  if (!message) return null;
  return (
    <>
      {burst && <SparkleBurst />}
      <CelebrationToast message={message} />
    </>
  );
}
