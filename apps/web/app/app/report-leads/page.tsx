import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { buildWeeklyDigest } from "@/lib/report-digest";
import { readReportLeads, summarizeLeadsByType } from "@/lib/report-leads";
import { SendWeeklyPanel } from "./_send-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReportLeadsPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const leads = await readReportLeads();
  const byType = summarizeLeadsByType(leads);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";
  const digest = buildWeeklyDigest(snap, { siteUrl });
  const cronConfigured = Boolean(process.env.CRON_SECRET);

  // Next Monday at 13:00 UTC (09:00 ET) — matches the cron schedule in
  // .github/workflows/send-weekly-report.yml
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      13,
      0,
      0,
      0
    )
  );
  const dayOfWeek = next.getUTCDay(); // 0 Sun..6 Sat; 1 = Monday
  const daysUntilMonday =
    dayOfWeek === 1 && now < next ? 0 : (1 - dayOfWeek + 7) % 7 || 7;
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  const nextSendDisplay = next.toUTCString().replace("GMT", "UTC");

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Operations"
        title={<>Send the weekly Charge-Off Report.</>}
        lead={
          <>
            Every email captured from <Link href="/report" className="text-[color:var(--color-accent)] hover:underline">/report</Link> lands here.
            Preview this week&rsquo;s digest, send yourself a test, then push to
            every subscriber in one click. Resend handles delivery; this page is
            the cockpit.
          </>
        }
        doNow={
          leads.length === 0
            ? "No subscribers yet. Send yourself a test first — that's the dry run before paid traffic starts converting."
            : `${leads.length} subscriber${leads.length === 1 ? "" : "s"} ready. Send a test to yourself first, then hit Send to all.`
        }
        howThisWorks={
          <>
            <p>
              <code className="font-mono text-[12px] text-[color:var(--color-fg)]">/report</code> is the public landing page. Form submissions append to{" "}
              <code className="font-mono text-[12px] text-[color:var(--color-fg)]">data/output/report_leads.jsonl</code>{" "}
              (server-side; committed by your radar worker).
            </p>
            <p>
              This page reads that file, builds the email HTML from the current
              radar snapshot (same data as the live preview on <Link href="/report" className="text-[color:var(--color-accent)] hover:underline">/report</Link>),
              and sends via Resend&rsquo;s batch API (up to 100 emails per call).
              Each email gets a List-Unsubscribe header so it doesn&rsquo;t hit
              spam folders.
            </p>
            <p>
              The digest is built fresh on every render — no cached email
              bodies. Whatever&rsquo;s in the snapshot the moment you click Send
              is what subscribers get.
            </p>
          </>
        }
      />

      <section className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-lg overflow-hidden">
        <Stat label="Subscribers" value={leads.length.toString()} tone="accent" />
        <Stat label="Strong banks" value={digest.stats.strong.toString()} />
        <Stat label="Watching" value={digest.stats.watching.toString()} />
        <Stat label="Signals" value={digest.stats.signals.toString()} />
        <Stat label="News" value={digest.stats.news.toString()} />
      </section>

      <SendWeeklyPanel
        leads={leads}
        subject={digest.subject}
        html={digest.html}
        preheader={digest.preheader}
      />

      <section
        className={`mt-6 rounded-lg p-5 border ${
          cronConfigured
            ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
            : "border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div
              className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
                cronConfigured
                  ? "text-[color:var(--color-success)]"
                  : "text-[color:var(--color-warn)]"
              }`}
            >
              Auto-send schedule
            </div>
            <h3 className="mt-2 text-[15px] font-medium text-[color:var(--color-fg)]">
              {cronConfigured ? (
                <>Mondays 13:00 UTC (09:00 ET) — via GitHub Actions cron.</>
              ) : (
                <>Set CRON_SECRET to enable automated Monday sends.</>
              )}
            </h3>
            <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {cronConfigured ? (
                <>
                  Next fire: <span className="font-mono">{nextSendDisplay}</span>.
                  Workflow file: <code className="font-mono text-[12px]">.github/workflows/send-weekly-report.yml</code>.
                  You can still send manually above any time.
                </>
              ) : (
                <>
                  The endpoint <code className="font-mono text-[12px]">/api/cron/send-weekly</code> is live but rejects unauthenticated requests.
                  Add <code className="font-mono text-[12px]">CRON_SECRET</code> to Vercel env vars
                  and the same value as a GitHub repo secret (Settings → Secrets and variables → Actions).
                  Also add a <code className="font-mono text-[12px]">SITE_URL</code> repo secret (e.g.{" "}
                  <code className="font-mono text-[12px]">{siteUrl}</code>).
                </>
              )}
            </p>
          </div>
          <span
            className={`font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-1 rounded ${
              cronConfigured
                ? "bg-[color:var(--color-success)] text-[color:var(--color-bg)]"
                : "border border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
            }`}
          >
            {cronConfigured ? "Armed" : "Not armed"}
          </span>
        </div>
      </section>

      <section className="mt-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-3">
          Subscribers by type
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span
                key={type}
                className="font-mono text-[11px] tracking-[0.05em] px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] bg-[color:var(--color-bg-1)]"
              >
                {type} <span className="text-[color:var(--color-accent)] ml-1">{count}</span>
              </span>
            ))}
          {leads.length === 0 && (
            <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
              No subscribers yet.
            </span>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-3">
          Latest subscribers
        </div>
        {leads.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-8 text-center text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            No leads yet. Share <Link href="/report" className="text-[color:var(--color-accent)] hover:underline">/report</Link> on
            LinkedIn / X / RMAI &mdash; the form on that page writes to{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">data/output/report_leads.jsonl</code>.
          </div>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)] overflow-hidden">
            {leads.slice(0, 50).map((l) => (
              <div
                key={l.email}
                className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[13px] text-[color:var(--color-fg)] truncate">
                    {l.email}
                  </div>
                  {l.name && (
                    <div className="text-[12px] text-[color:var(--color-fg-dim)] truncate">
                      {l.name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]">
                    {l.type || "other"}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                    {l.submittedAt.slice(0, 10)}
                  </span>
                </div>
              </div>
            ))}
            {leads.length > 50 && (
              <div className="px-5 py-2 text-[11px] font-mono text-[color:var(--color-fg-faint)] text-center">
                + {leads.length - 50} more
              </div>
            )}
          </div>
        )}
      </section>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC. Email
        delivery requires <code className="text-[color:var(--color-fg)]">RESEND_API_KEY</code>{" "}
        and <code className="text-[color:var(--color-fg)]">RESEND_FROM</code> environment variables.
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "accent" | "default";
}) {
  const color =
    tone === "accent" ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl ${color}`}>{value}</div>
    </div>
  );
}
