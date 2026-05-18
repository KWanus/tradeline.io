import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Status · Tradeline",
  description:
    "Live status of the Tradeline radar, weekly digest cron, and email infrastructure. Powered by /api/health.",
};

type ServiceCheck = {
  name: string;
  label: string;
  ok: boolean;
  detail: string;
};

type SnapshotCheck = {
  ok: boolean;
  ageHours: number | null;
  generatedAt: string | null;
  banks: number;
  signals: number;
  filings: number;
};

function computeSnapshotCheck(snap: RadarSnapshot): SnapshotCheck {
  const generatedAt = snap.generated_at || null;
  let ageHours: number | null = null;
  if (generatedAt) {
    const ageMs = Date.now() - new Date(generatedAt).getTime();
    ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
  }
  const banks = snap.originators?.length || 0;
  const signals = snap.summary?.sec_signals_total || 0;
  const filings = snap.summary?.filings_total || 0;
  const ok = ageHours !== null && ageHours < 12 && banks > 0;
  return { ok, ageHours, generatedAt, banks, signals, filings };
}

export default async function StatusPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const snapshot = computeSnapshotCheck(snap);

  const services: ServiceCheck[] = [
    {
      name: "anthropic",
      label: "Anthropic (AI tutor + briefing + classifier)",
      ok: Boolean(process.env.ANTHROPIC_API_KEY),
      detail:
        "Powers /app/tutor, the daily briefing on /app/today, and the broker-reply classifier.",
    },
    {
      name: "resend",
      label: "Resend (transactional email)",
      ok: Boolean(process.env.RESEND_API_KEY),
      detail:
        "Sends welcome emails on /report signup, the weekly digest, broker outreach, and design-partner notifications.",
    },
    {
      name: "cron",
      label: "Cron secret (Monday auto-send)",
      ok: Boolean(process.env.CRON_SECRET),
      detail:
        "Authorizes /api/cron/send-weekly. The GitHub Actions workflow fires every Monday 13:00 UTC when set.",
    },
    {
      name: "unsubscribe",
      label: "Unsubscribe signing key",
      ok: Boolean(process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET),
      detail:
        "Required to mint signed one-click unsubscribe links in every weekly email. Falls back to CRON_SECRET.",
    },
  ];

  const criticalOk =
    snapshot.ok && snapshot.ageHours !== null && snapshot.ageHours < 24;
  const overall: "ok" | "degraded" | "stale" = !snapshot.ok
    ? "stale"
    : !criticalOk
      ? "degraded"
      : "ok";

  const overallCopy =
    overall === "ok"
      ? {
          headline: "All systems operational.",
          tone: "success" as const,
          body: `Radar refreshed ${snapshot.ageHours}h ago. ${snapshot.banks} banks scored, ${snapshot.signals.toLocaleString()} signals indexed.`,
        }
      : overall === "degraded"
        ? {
            headline: "Radar is stale.",
            tone: "warn" as const,
            body: `Snapshot is ${snapshot.ageHours ?? "—"}h old. The 6-hour cron may have missed a window; the next run should restore freshness.`,
          }
        : {
            headline: "Radar offline.",
            tone: "danger" as const,
            body: "No fresh snapshot. The worker may be failing or its output isn't reaching this deployment.",
          };

  const configuredCount = services.filter((s) => s.ok).length;

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <a
          href="/api/health"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          /api/health JSON &nearr;
        </a>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Status
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05]">
          Live infrastructure check.
        </h1>

        <section
          className={`mt-8 rounded-xl p-6 border ${
            overallCopy.tone === "success"
              ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
              : overallCopy.tone === "warn"
                ? "border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
                : "border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
          }`}
        >
          <div
            className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
              overallCopy.tone === "success"
                ? "text-[color:var(--color-success)]"
                : overallCopy.tone === "warn"
                  ? "text-[color:var(--color-warn)]"
                  : "text-[color:var(--color-danger)]"
            }`}
          >
            Overall · {overall}
          </div>
          <h2 className="mt-2 font-serif text-2xl md:text-3xl tracking-tight italic">
            {overallCopy.headline}
          </h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {overallCopy.body}
          </p>
        </section>

        <section className="mt-10">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)] mb-3">
            Radar snapshot
          </div>
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Tile
                label="Status"
                value={snapshot.ok ? "Fresh" : "Stale"}
                tone={snapshot.ok ? "success" : "warn"}
              />
              <Tile
                label="Age"
                value={snapshot.ageHours !== null ? `${snapshot.ageHours}h` : "—"}
                tone={
                  snapshot.ageHours !== null && snapshot.ageHours < 12
                    ? "success"
                    : "warn"
                }
              />
              <Tile label="Banks" value={snapshot.banks.toString()} />
              <Tile label="Signals" value={snapshot.signals.toLocaleString()} />
            </div>
            <p className="mt-4 text-[12px] font-mono text-[color:var(--color-fg-faint)]">
              Snapshot generated{" "}
              {snapshot.generatedAt
                ? snapshot.generatedAt.slice(0, 16) + " UTC"
                : "—"}
              . Workers cron runs every 6h via{" "}
              <code className="text-[color:var(--color-fg-dim)]">.github/workflows/workers.yml</code>.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)] mb-3">
            Services · {configuredCount}/{services.length} configured
          </div>
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {services.map((s) => (
              <div
                key={s.name}
                className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-[240px]">
                  <div className="text-[14px] font-medium text-[color:var(--color-fg)]">
                    {s.label}
                  </div>
                  <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {s.detail}
                  </p>
                </div>
                <span
                  className={`font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-1 rounded ${
                    s.ok
                      ? "border border-[color:var(--color-success-dim)] text-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
                      : "border border-[color:var(--color-warn)] text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
                  }`}
                >
                  {s.ok ? "Armed" : "Not set"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            For monitoring tools
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Hit{" "}
            <code className="font-mono text-[13px] text-[color:var(--color-fg)]">
              /api/health
            </code>{" "}
            from UptimeRobot / BetterUptime / Healthchecks.io. Returns 200 with{" "}
            <code className="font-mono text-[13px] text-[color:var(--color-fg)]">
              status: ok | degraded | stale
            </code>{" "}
            so you can alert on the body, not just the HTTP code (brief 5xx
            spikes don&rsquo;t generate noise).
          </p>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Rendered server-side at request time. No caching — what you see is
          exactly what the next request will compute.
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warn";
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl ${color}`}>{value}</div>
    </div>
  );
}
