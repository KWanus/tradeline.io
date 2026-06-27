import type { QueuePreview } from "@/lib/autopilot/queue-preview";

/** Inline preview of the autopilot queue. Only rendered when a preview exists
 * (the page guards with `{queuePreview && ...}`), so this never shows an empty
 * shell. */
export function UpNextPanel({ preview }: { preview: QueuePreview }) {
  if (!preview.items.length) return null;

  return (
    <section className="mb-6 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mb-2">
        Up next · autopilot
      </div>
      <ul className="space-y-1.5">
        {preview.items.slice(0, 5).map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-[13px]">
            <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)] w-6">
              {item.score}
            </span>
            <span className="text-[color:var(--color-fg)] flex-1 truncate">
              {item.label}
            </span>
            {item.detail && (
              <span className="text-[12px] text-[color:var(--color-fg-dim)] truncate hidden md:block">
                {item.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
