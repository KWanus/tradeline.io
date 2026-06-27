import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

function relAge(iso: string): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "under an hour ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Small status line: how fresh the radar snapshot is. Honest about staleness
 * so the operator knows whether the cron is current. */
export async function SystemStatusCard() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const age = relAge(snap.generated_at);
  const stale =
    !snap.generated_at ||
    Date.now() - new Date(snap.generated_at).getTime() > 36 * 3_600_000;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-2.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          stale ? "bg-[color:var(--color-warn)]" : "bg-[color:var(--color-success)] glow"
        }`}
      />
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        Radar
      </span>
      <span className="text-[12px] text-[color:var(--color-fg-dim)]">
        Snapshot updated {age}
        {stale ? " — cron may be idle; check the workers run." : "."} Public
        sources only.
      </span>
    </div>
  );
}
