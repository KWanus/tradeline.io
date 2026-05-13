"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a "just completed" state per step ID. Returns helpers to:
 *   - trigger() when a step transitions to done (call this from the checkbox toggle)
 *   - isJustDone(id) to check if a row should have the glow animation
 *   - lastMessage / setLastMessage for the toast
 *
 * Animations expire on their own; this hook just gates which row gets the
 * "row-glow" class for ~1.1s after the click.
 */
export function useDoneCelebration(durationMs = 1200) {
  const [justDoneId, setJustDoneId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const trigger = (id: string, message?: string) => {
    setJustDoneId(id);
    if (message) setToast(message);
  };

  useEffect(() => {
    if (!justDoneId) return;
    const t = window.setTimeout(() => setJustDoneId(null), durationMs);
    return () => window.clearTimeout(t);
  }, [justDoneId, durationMs]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1700);
    return () => window.clearTimeout(t);
  }, [toast]);

  return {
    justDoneId,
    isJustDone: (id: string) => id === justDoneId,
    trigger,
    toast,
    setToast,
  };
}

/**
 * Floating "✓ Step done!" toast at the bottom-center of the viewport.
 * Auto-clears via the hook above.
 */
export function CelebrationToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      key={message}
      aria-live="polite"
      className="animate-toast fixed bottom-24 left-1/2 z-50 pointer-events-none"
    >
      <div
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[#1a0c00] font-semibold text-[13px] shadow-[0_14px_38px_-10px_rgba(236,72,153,0.55),0_0_0_1px_rgba(245,166,35,0.4)]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <span className="text-[15px] leading-none">✓</span>
        <span>{message}</span>
      </div>
    </div>
  );
}

/**
 * Six sparkles that burst from the center of the checkbox when a step is
 * marked done. Auto-removes via the CSS animation's forwards fill-mode.
 */
export function SparkleBurst() {
  // angles in degrees, varied for natural-feeling spread
  const offsets = [-32, -18, -6, 6, 18, 32];
  return (
    <span className="pointer-events-none">
      {offsets.map((sx, i) => (
        <span
          key={i}
          className="sparkle-burst"
          style={
            {
              "--sx": `${sx}px`,
              animationDelay: `${i * 18}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * Celebration banner that shows when a tracked checklist hits 100%.
 * Pass `visible` and a label; auto-hides after first dismiss.
 */
export function MilestoneBanner({
  visible,
  label,
  sublabel,
  onDismiss,
}: {
  visible: boolean;
  label: string;
  sublabel?: string;
  onDismiss?: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      className="milestone-shine relative rounded-2xl p-5 md:p-6 mb-6"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)] mb-1">
            Milestone hit
          </div>
          <h3 className="font-serif italic text-2xl md:text-3xl text-[color:var(--color-fg)] tracking-tight">
            {label}
          </h3>
          {sublabel && (
            <p className="mt-1.5 text-[13px] text-[color:var(--color-fg-dim)]">
              {sublabel}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
