"use client";

import { useEffect, useRef } from "react";

const TOKEN_KEY = "tradeline.autopilot_token.v1";
const LAST_PING_KEY = "tradeline.autopilot_last_ping.v1";

/**
 * Fire-and-forget heartbeat that tells autopilot the operator is still
 * checking in. Mounted on /app/today so any open of the workbase counts.
 * Throttled to once per 6 hours to avoid spamming the data-branch commit
 * log. Silent: no UI; no errors surfaced to the user.
 */
export function AutopilotPing() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    try {
      const last = window.localStorage.getItem(LAST_PING_KEY);
      if (last) {
        const ms = Date.now() - Number(last);
        if (ms < 6 * 60 * 60 * 1000) return; // throttled
      }
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (!token) return; // not authorized yet; nothing to do

      fetch("/api/autopilot/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "ping-login" }),
      })
        .then(() => {
          try {
            window.localStorage.setItem(LAST_PING_KEY, String(Date.now()));
          } catch {}
        })
        .catch(() => {});
    } catch {}
  }, []);

  return null;
}
