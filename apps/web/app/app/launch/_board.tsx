"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CelebrationToast,
  MilestoneBanner,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";

const STORAGE_KEY = "tradeline.launch_progress.v1";

type LaunchStep = {
  id: string;
  number: string;
  title: string;
  rec: string;
  rationale: string;
  what: string[];                        // numbered substeps
  doneBy: "you" | "tradeline" | "vendor";
  costRange: string;
  timeRange: string;
  primaryAction: { label: string; href: string; external?: boolean };
  secondaryActions?: { label: string; href: string; external?: boolean }[];
};

const STEPS: LaunchStep[] = [
  {
    id: "1",
    number: "01",
    title: "Lock in a domain",
    rec: "tradelineos.com",
    rationale:
      "tradeline.io / .ai / .com are all owned by others. tradelineos.com matches your 'workbase / operating system' framing and is registrable today.",
    what: [
      "Open Cloudflare Registrar (zero-markup, free Whois privacy).",
      "Search tradelineos.com. If taken, try trytradeline.com or paperline.io.",
      "Buy it. Add Cloudflare DNS (free tier).",
      "Hold the DNS records — you'll point them at Vercel in Step 02.",
    ],
    doneBy: "you",
    costRange: "$10–18/yr",
    timeRange: "~15 min",
    primaryAction: {
      label: "Open Cloudflare Registrar",
      href: "https://www.cloudflare.com/products/registrar/",
      external: true,
    },
    secondaryActions: [
      { label: "Porkbun (backup)", href: "https://porkbun.com/", external: true },
    ],
  },
  {
    id: "2",
    number: "02",
    title: "Deploy to Vercel",
    rec: "Vercel free tier (Hobby plan)",
    rationale:
      "Vercel runs the existing Next.js app with zero infra changes. Hobby tier is free for personal projects; upgrade to Pro ($20/mo) once you have paying customers.",
    what: [
      "Push the repo to GitHub: gh repo create tradeline --private --source=. && git push -u origin main",
      "At vercel.com, click 'Add New Project' and import the GitHub repo.",
      "Set environment variables in Vercel:",
      "  • ANTHROPIC_API_KEY — Sonnet 4.6 for AI tutor + talking points",
      "  • RESEND_API_KEY — real email delivery to subscribers",
      "  • RESEND_FROM — 'Tradeline <alerts@tradelineos.com>' (after Step 04 verifies the domain in Resend)",
      "  • REPORT_LEADS_NOTIFY_TO — your email; gets pinged on new /report signups",
      "  • TRADELINE_SNAPSHOT_URL — set after Step 03 finishes",
      "Connect your domain (tradelineos.com) in Vercel → Domains.",
      "First deploy in ~3 minutes. Site is live.",
    ],
    doneBy: "you",
    costRange: "Free",
    timeRange: "~30 min",
    primaryAction: {
      label: "Open Vercel",
      href: "https://vercel.com/new",
      external: true,
    },
    secondaryActions: [
      {
        label: "See deploy doc",
        href: "/app/learn",
      },
    ],
  },
  {
    id: "3",
    number: "03",
    title: "Wire the data cron",
    rec: "GitHub Actions (already configured)",
    rationale:
      "Tradeline already includes .github/workflows/workers.yml — a 6-hourly cron that runs the SEC EDGAR + XBRL + news + court workers and writes the snapshot to an orphan 'data' branch. Free on public + private repos under GitHub's 2,000 Actions minutes/month.",
    what: [
      "In your GitHub repo, set the secret: gh secret set TRADELINE_SEC_UA --body 'Tradeline workers your-email@tradelineos.com' (SEC requires a contact in the User-Agent)",
      "Enable Actions in repo settings if disabled by default.",
      "Trigger first run: gh workflow run workers.yml",
      "After first run completes (~3 min), your snapshot lives at: https://raw.githubusercontent.com/USERNAME/tradeline/data/radar_snapshot.json",
      "In Vercel → Environment Variables, set TRADELINE_SNAPSHOT_URL to that URL.",
      "Redeploy Vercel. Now /app/today pulls live data refreshed every 6 hours.",
    ],
    doneBy: "tradeline",
    costRange: "Free",
    timeRange: "~15 min",
    primaryAction: {
      label: "Open Actions tab",
      href: "https://github.com/new",
      external: true,
    },
  },
  {
    id: "4",
    number: "04",
    title: "First 20 outreach + email delivery",
    rec: "Resend + LinkedIn outbound",
    rationale:
      "You don't need RMAI membership ($1,500/yr) to start. LinkedIn search for 'debt buyer' or 'receivables management' returns 40k+ decision-makers in the US. Send 20 a personalized intro with the /report URL. Real email delivery via Resend (free 3k emails/mo) so /report signups and /app/subscribers alerts actually go out.",
    what: [
      "Verify your domain in Resend (resend.com → Domains → Add tradelineos.com → set DNS records in Cloudflare). Takes ~10 min for propagation.",
      "Get API key from Resend → set RESEND_API_KEY in Vercel.",
      "On LinkedIn, search 'debt buyer' OR 'receivables manager'. Filter to current decision-makers (titles: Managing Director, Head of Acquisitions, VP).",
      "Send 20 personalized messages with the /report URL: 'Hey [name], built a tool that scores divestiture probability per US bank from public filings — free weekly digest. Curious if it's useful for your acquisitions team. → tradelineos.com/report'",
      "Track responses as Trial subscribers in /app/customers. Convert any conversation to a paid Solo ($99) or Pro ($299) subscription via a 14-day trial.",
      "Same playbook works for the supply-side (brokers / lenders / attorneys / CPAs): send to /app/marketplace landing instead.",
    ],
    doneBy: "you",
    costRange: "Free (Resend free tier)",
    timeRange: "~2 hours",
    primaryAction: {
      label: "Open Resend",
      href: "https://resend.com/api-keys",
      external: true,
    },
    secondaryActions: [
      { label: "Customer CRM", href: "/app/customers" },
      { label: "Subscriber CRM", href: "/app/subscribers" },
    ],
  },
];

const DONE_BY_LABEL: Record<LaunchStep["doneBy"], { label: string; tone: string }> = {
  you: {
    label: "You do this",
    tone: "text-[color:var(--color-fg)] border-[color:var(--color-line-strong)]",
  },
  tradeline: {
    label: "Tradeline pre-built this",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]",
  },
  vendor: {
    label: "A vendor does this",
    tone: "text-[color:var(--color-accent-3)] border-[color:var(--color-accent-3)]",
  },
};

function loadProgress(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveProgress(s: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

export function LaunchBoard() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [milestoneSeen, setMilestoneSeen] = useState(false);
  const celebration = useDoneCelebration();

  useEffect(() => {
    setCompleted(loadProgress());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProgress(completed);
  }, [completed, hydrated]);

  const toggle = (id: string) => {
    let becameDone = false;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        becameDone = true;
      }
      return next;
    });
    if (becameDone) {
      const step = STEPS.find((s) => s.id === id);
      celebration.trigger(id, `Step done · ${step?.title ?? "Launch step"}`);
    }
  };

  const completedCount = completed.size;
  const pct = (completedCount / STEPS.length) * 100;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="card-hero p-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2">
            <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Go live — Path A
            </div>
            <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
              4 steps. One day.{" "}
              <span className="italic text-gradient-accent">Tradeline is selling.</span>
            </h1>
            <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
              The product is already built. To start collecting subscriber
              revenue from licensed buyers, brokers, lenders, attorneys, and
              CPAs — four steps. Total cost: under $50. Total time: one
              focused day.
            </p>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                Launch progress
              </div>
              <div className="font-mono text-[14px] text-[color:var(--color-fg)] tick">
                {completedCount} / {STEPS.length}
              </div>
            </div>
            <div className="h-3 bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: "var(--gradient-primary)",
                  boxShadow: "0 0 14px rgba(236, 72, 153, 0.45)",
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div className="card p-3">
                <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  Total cost
                </div>
                <div className="mt-1 font-mono text-[18px] text-[color:var(--color-fg)] tick">
                  ~$18
                </div>
              </div>
              <div className="card p-3">
                <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  Total time
                </div>
                <div className="mt-1 font-mono text-[18px] text-[color:var(--color-fg)] tick">
                  ~3 hrs
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-4">
        {hydrated && completedCount === STEPS.length && !milestoneSeen && (
          <MilestoneBanner
            visible
            label="Path A complete. Your SaaS is live."
            sublabel="Time to send the next 20 outreach emails — your first dollar is earned by closing a customer, not by checking boxes."
            onDismiss={() => setMilestoneSeen(true)}
          />
        )}
        {STEPS.map((step) => {
          const done = completed.has(step.id);
          const justDone = celebration.isJustDone(step.id);
          const doneByCopy = DONE_BY_LABEL[step.doneBy];
          return (
            <article
              key={step.id}
              className={`card p-6 md:p-7 transition ${done ? "opacity-70" : ""} ${
                justDone ? "animate-row-glow" : ""
              }`}
            >
              <div className="flex items-start gap-5">
                {hydrated && (
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    aria-label={done ? "Mark incomplete" : "Mark complete"}
                    className={`relative shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center transition font-mono text-[14px] ${
                      done
                        ? "bg-[color:var(--color-success)] border-[color:var(--color-success-dim)] text-[color:var(--color-bg)]"
                        : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
                    } ${justDone ? "animate-check-pop" : ""}`}
                  >
                    {done ? (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path
                          d="M17 7L9 15L5 11"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                    {justDone && <SparkleBurst />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h2
                      className={`font-serif text-[24px] md:text-[28px] text-[color:var(--color-fg)] tracking-tight leading-tight ${
                        done ? "line-through opacity-70" : ""
                      }`}
                    >
                      {step.title}
                    </h2>
                    <span
                      className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border whitespace-nowrap ${doneByCopy.tone}`}
                    >
                      {doneByCopy.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-3 flex-wrap text-[14px]">
                    <span className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                      Our pick
                    </span>
                    <span className="text-[color:var(--color-accent)] font-medium">
                      {step.rec}
                    </span>
                  </div>

                  <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    <span className="text-[color:var(--color-fg)]">Why:</span>{" "}
                    {step.rationale}
                  </p>

                  <div className="mt-4">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
                      What to do
                    </div>
                    <ol className="space-y-2 list-decimal pl-5 text-[14px] text-[color:var(--color-fg)] leading-relaxed marker:text-[color:var(--color-fg-faint)] marker:font-mono marker:text-[11px]">
                      {step.what.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-5 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3 text-[11px] text-[color:var(--color-fg-faint)] font-mono">
                      <span>{step.costRange}</span>
                      <span>·</span>
                      <span>{step.timeRange}</span>
                    </div>
                    {step.primaryAction.external ? (
                      <a
                        href={step.primaryAction.href}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                      >
                        {step.primaryAction.label}
                      </a>
                    ) : (
                      <Link
                        href={step.primaryAction.href as never}
                        className="btn-primary"
                      >
                        {step.primaryAction.label}
                      </Link>
                    )}
                    {step.secondaryActions?.map((sa) =>
                      sa.external ? (
                        <a
                          key={sa.label}
                          href={sa.href}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost"
                        >
                          {sa.label}
                        </a>
                      ) : (
                        <Link
                          key={sa.label}
                          href={sa.href as never}
                          className="btn-ghost"
                        >
                          {sa.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Completion CTA */}
      {completedCount === STEPS.length && (
        <section className="card-hero p-8 md:p-12 text-center">
          <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
            Path A complete
          </div>
          <h2 className="mt-3 font-serif text-3xl md:text-5xl tracking-tight">
            Tradeline is live and selling.
          </h2>
          <p className="mt-4 text-[color:var(--color-fg-dim)] text-lg max-w-2xl mx-auto">
            Next: track first sign-ups in /app/customers and /app/subscribers,
            and start working Path B (the 12-month operator path) in parallel
            so the licensed-buyer arm comes online while the SaaS is generating
            revenue.
          </p>
          <div className="mt-7 flex items-center gap-3 justify-center flex-wrap">
            <Link href="/app/customers" className="btn-primary">
              Open Customer CRM
            </Link>
            <Link href="/app/path" className="btn-secondary">
              Start Path B
            </Link>
          </div>
        </section>
      )}
      <CelebrationToast message={celebration.toast} />
    </div>
  );
}
