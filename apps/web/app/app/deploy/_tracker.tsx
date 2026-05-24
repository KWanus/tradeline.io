"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CelebrationToast,
  MilestoneBanner,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";

type Step = {
  id: string;
  title: string;
  body: string;
  primary: { label: string; href: string; external?: boolean };
  secondary?: { label: string; href: string; external?: boolean };
  sanityCheck: string;
  estMinutes: number;
};

const STEPS: Step[] = [
  {
    id: "vercel",
    title: "Deploy to Vercel",
    body: "Import the GitHub repo, set Root Directory to apps/web, add the ANTHROPIC_API_KEY env var, click Deploy. Vercel gives you a free *.vercel.app URL in ~90 seconds.",
    primary: { label: "Open Vercel new project", href: "https://vercel.com/new", external: true },
    secondary: { label: "GitHub repo", href: "https://github.com/KWanus/tradeline.io", external: true },
    sanityCheck: "Your *.vercel.app URL loads the dark UI with amber-pink gradient buttons.",
    estMinutes: 5,
  },
  {
    id: "actions",
    title: "Enable GitHub Actions cron",
    body: "Turn on workflows, add the TRADELINE_SEC_UA secret (your email — SEC requires a contact in their User-Agent), and trigger the workers job manually once so you don't wait 6 hours for the first run.",
    primary: { label: "GitHub Actions tab", href: "https://github.com/KWanus/tradeline.io/actions", external: true },
    secondary: { label: "Add secret", href: "https://github.com/KWanus/tradeline.io/settings/secrets/actions", external: true },
    sanityCheck: "https://github.com/KWanus/tradeline.io/tree/data shows a radar_snapshot.json file.",
    estMinutes: 5,
  },
  {
    id: "snapshot",
    title: "Wire snapshot URL in Vercel",
    body: "In Vercel project settings → Environment Variables, add TRADELINE_SNAPSHOT_URL pointing at the raw GitHub data branch. Then redeploy so the new env var takes effect.",
    primary: { label: "Vercel dashboard", href: "https://vercel.com/dashboard", external: true },
    sanityCheck: "Live site /app/banks shows 57 banks with today's refresh time in the sidebar footer.",
    estMinutes: 2,
  },
  {
    id: "resend",
    title: "Resend email delivery",
    body: "Sign up at Resend, verify a domain (or use onboarding@resend.dev sandbox), add RESEND_API_KEY + RESEND_FROM + REPORT_LEADS_NOTIFY_TO to Vercel env vars, redeploy.",
    primary: { label: "Resend sign-up", href: "https://resend.com/signup", external: true },
    sanityCheck: "Subscribe form at /report accepts a test email and you receive the notification.",
    estMinutes: 5,
  },
  {
    id: "domain",
    title: "Custom domain (optional)",
    body: "Buy a domain (~$15/yr — Cloudflare recommended). In Vercel → Settings → Domains → Add. Update Cloudflare DNS records. Wait ~5 min for SSL.",
    primary: { label: "Cloudflare domains", href: "https://dash.cloudflare.com/?to=/:account/domains", external: true },
    sanityCheck: "https://yourdomain.com loads the marketing page with HTTPS.",
    estMinutes: 10,
  },
  {
    id: "outreach",
    title: "Send the first 20 outreach emails",
    body: "Fill your buyer profile so every email auto-fills. Open the playbook for templates. Target: 5 debt brokers, 5 collection attorneys, 5 hypothecation lenders, 5 licensed debt buyers. Use Stripe Payment Links for billing until in-app checkout ships.",
    primary: { label: "Fill profile", href: "/app/profile" },
    secondary: { label: "Open playbook", href: "/app/playbook" },
    sanityCheck: "A subscriber Stripe-pays you. Add them to /app/subscribers. You're in business.",
    estMinutes: 60,
  },
];

const STEPS_KEY = "tradeline.deploy_progress.v1";

export function DeployTracker() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [milestoneSeen, setMilestoneSeen] = useState(false);
  const celebration = useDoneCelebration();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STEPS_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify(done));
    } catch {}
  }, [done, hydrated]);

  const toggle = (id: string) => {
    const becameDone = !done[id];
    setDone((d) => ({ ...d, [id]: !d[id] }));
    if (becameDone) {
      const step = STEPS.find((s) => s.id === id);
      celebration.trigger(id, `Done · ${step?.title ?? "Step"}`);
    }
  };

  const completed = STEPS.filter((s) => done[s.id]).length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const nextStep = STEPS.find((s) => !done[s.id]);

  const allDone = completed === STEPS.length;

  return (
    <section className="space-y-6">
      {allDone && !milestoneSeen && (
        <MilestoneBanner
          visible
          label="Deploy complete. Tradeline is on the open internet."
          sublabel="Every infrastructure piece is wired. The next $ comes from a customer clicking pay — not a checkbox. Open /app/customers to log your first."
          onDismiss={() => setMilestoneSeen(true)}
        />
      )}

      {/* Progress bar */}
      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Progress
          </div>
          <div className="font-mono text-[14px] text-[color:var(--color-accent)]">
            {completed} / {STEPS.length} · {pct}%
          </div>
        </div>
        <div className="h-2.5 bg-[color:var(--color-bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "var(--gradient-primary)",
              boxShadow: pct > 0 ? "0 0 14px rgba(var(--tint-accent-2-rgb), 0.45)" : undefined,
            }}
          />
        </div>
        {nextStep ? (
          <div className="mt-3 text-[12px] text-[color:var(--color-fg-dim)]">
            Up next: <strong className="text-[color:var(--color-fg)]">{nextStep.title}</strong>{" "}
            · ~{nextStep.estMinutes}min
          </div>
        ) : (
          <div className="mt-3 text-[13px] text-[color:var(--color-success)] font-medium">
            ✓ All steps complete. You&rsquo;re live and operational.
          </div>
        )}
      </div>

      {/* Step cards */}
      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const isDone = !!done[s.id];
          const isNext = nextStep?.id === s.id;
          const justDone = celebration.isJustDone(s.id);
          return (
            <li
              key={s.id}
              className={`relative rounded-2xl p-5 md:p-6 transition ${
                isNext
                  ? ""
                  : isDone
                    ? "border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
                    : "border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
              } ${justDone ? "animate-row-glow" : ""}`}
              style={
                isNext
                  ? {
                      background:
                        "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                      border: "1.5px solid transparent",
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`relative shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center transition ${
                    isDone
                      ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-[color:var(--color-bg)]"
                      : isNext
                        ? "border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)]"
                        : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)]"
                  } ${justDone ? "animate-check-pop" : ""}`}
                  aria-label={isDone ? "Mark step incomplete" : "Mark step complete"}
                >
                  {isDone ? "✓" : (
                    <span className="font-mono text-[13px] text-[color:var(--color-fg-faint)]">
                      {i + 1}
                    </span>
                  )}
                  {justDone && <SparkleBurst />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <h3
                      className={`font-semibold text-xl md:text-2xl tracking-tight ${
                        isDone
                          ? "text-[color:var(--color-fg-dim)] line-through"
                          : "text-[color:var(--color-fg)]"
                      }`}
                    >
                      {s.title}
                    </h3>
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                      ~{s.estMinutes} min
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {s.body}
                  </p>
                  <div className="mt-3 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-3 py-2 text-[12px] text-[color:var(--color-fg-dim)]">
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-1.5">
                      ✓ Done when
                    </span>
                    {s.sanityCheck}
                  </div>
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {s.primary.external ? (
                      <a
                        href={s.primary.href}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                      >
                        {s.primary.label}
                      </a>
                    ) : (
                      <Link href={s.primary.href} className="btn-primary">
                        {s.primary.label}
                      </Link>
                    )}
                    {s.secondary && (
                      s.secondary.external ? (
                        <a
                          href={s.secondary.href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                        >
                          {s.secondary.label} ↗
                        </a>
                      ) : (
                        <Link
                          href={s.secondary.href}
                          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                        >
                          {s.secondary.label}
                        </Link>
                      )
                    )}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => toggle(s.id)}
                        className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-success)] transition"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-4 py-3 text-[12px] text-[color:var(--color-fg-dim)] flex items-center gap-3 flex-wrap">
        <span>Progress saved on this device.</span>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset deploy progress?")) setDone({});
          }}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
        >
          Reset all
        </button>
      </div>
      <CelebrationToast message={celebration.toast} />
    </section>
  );
}
