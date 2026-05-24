"use client";

import { useEffect } from "react";

/**
 * Drives the "alive" interaction layer by writing CSS variables on <html>
 * that the rest of the app's styles consume:
 *
 *   --cursor-x / --cursor-y       (0..1) pointer position in viewport
 *   --light-dx / --light-dy       (-1..1) direction from screen center
 *   --iridescent-h-fast           hue tied to cursor X (260..300, violet→magenta)
 *   --iridescent-h-slow           hue drifting across 24h (220..280)
 *   --time-warmth                 (0..1) cool at night, warm at midday
 *   --sun-x                       (0..1) time of day, 0 = midnight, 0.5 = noon
 *
 * Powers .living-lantern (cursor spotlight overlay) and the directional
 * text-shadow on headings + glass-card hover spotlight (see globals.css).
 *
 * Honors `prefers-reduced-motion`: when set, drops the cursor tracking and
 * only updates time-of-day vars (once per minute, no rAF loop).
 */
export function LivingSurface() {
  useEffect(() => {
    const root = document.documentElement;

    const writeTimeOfDay = () => {
      const now = new Date();
      const h = now.getHours() + now.getMinutes() / 60;
      const t = h / 24;
      // Warmth: sin curve peaks at noon, troughs at midnight
      const warmth = Math.sin((t - 0.25) * Math.PI * 2) * 0.5 + 0.5;
      root.style.setProperty("--time-warmth", warmth.toFixed(3));
      // Slow hue drifts ~30° around violet (250 ± 30)
      const slowH = 250 + Math.sin(t * Math.PI * 2) * 30;
      root.style.setProperty("--iridescent-h-slow", slowH.toFixed(1));
      root.style.setProperty("--sun-x", t.toFixed(3));
    };

    const reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      writeTimeOfDay();
      // Center the cursor vars so anything reading them lands somewhere sane
      root.style.setProperty("--cursor-x", "0.5");
      root.style.setProperty("--cursor-y", "0.5");
      root.style.setProperty("--light-dx", "0");
      root.style.setProperty("--light-dy", "0");
      root.style.setProperty("--iridescent-h-fast", "280");
      const intv = window.setInterval(writeTimeOfDay, 60_000);
      return () => window.clearInterval(intv);
    }

    let cx = 0.5;
    let cy = 0.5;
    let tx = 0.5;
    let ty = 0.5;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let lastTime = 0;
    const tick = (now: number) => {
      // Ease toward target — feels organic, not jittery
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;

      root.style.setProperty("--cursor-x", cx.toFixed(4));
      root.style.setProperty("--cursor-y", cy.toFixed(4));
      const dx = (cx - 0.5) * 2;
      const dy = (cy - 0.5) * 2;
      root.style.setProperty("--light-dx", dx.toFixed(4));
      root.style.setProperty("--light-dy", dy.toFixed(4));
      // Fast hue rotates 260..300 (violet→magenta) with cursor X
      const fastH = 260 + cx * 40;
      root.style.setProperty("--iridescent-h-fast", fastH.toFixed(1));

      // Only update time-of-day vars once a second (cheap; doesn't change fast)
      if (now - lastTime > 1000) {
        writeTimeOfDay();
        lastTime = now;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 living-lantern"
    />
  );
}
