"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly counts up from 0 (or `from`) to `value` over `durationMs`.
 * Respects `prefers-reduced-motion`: snaps to the final value with no tween.
 *
 * Use inside StatCard / dashboard tiles so numbers feel "earned" instead of
 * popping. For non-integer values (currency, percentages) pass `format`.
 *
 *   <CountUp value={1247} />                          // "1247"
 *   <CountUp value={4287.5} format={(n) => `$${n.toFixed(0)}`} />  // "$4288"
 *   <CountUp value={92} format={(n) => `${Math.round(n)}%`} />     // "92%"
 */
export function CountUp({
  value,
  from = 0,
  durationMs = 800,
  format,
}: {
  value: number;
  from?: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(from);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    startRef.current = 0;
    fromRef.current = display;

    const tick = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / durationMs);
      // ease-out-cubic — fast start, gentle landing
      const eased = 1 - Math.pow(1 - k, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // Intentionally exclude `display` so re-renders during the tween don't
    // restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <>{format ? format(display) : Math.round(display).toLocaleString()}</>;
}
