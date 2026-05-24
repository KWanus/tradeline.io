"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import { useWatchlist } from "@/lib/bank-state";
import { readDeals } from "@/lib/pipeline";

type Priority = {
  kind:
    | "profile-empty"
    | "license-expiring"
    | "outreach-queued"
    | "outreach-follow-up"
    | "stale-deal"
    | "at-risk-customer"
    | "watchlist-green"
    | "green-bank"
    | "all-clear";
  title: string;
  detail: string;
  cta: { label: string; href: string };
  tone: "urgent" | "action" | "neutral";
};

type StrongBank = {
  ticker: string;
  name: string;
  signalLabel?: string;
};

const STORAGE = {
  licenses: "tradeline.compliance.licenses.v1",
  customers: "tradeline.customers.v1",
  approvalState: "tradeline.approval_state.v2",
};

type ApprovalState = Record<string, "approved" | "skipped">;

function daysUntilDate(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function RightNowWidget({
  strongBanks,
  outreachProposalIds = [],
}: {
  strongBanks: StrongBank[];
  /** Server-known ids of today's queued outreach proposals. Used to detect
   * how many remain unactioned in the inbox. */
  outreachProposalIds?: string[];
}) {
  const [profile] = useBuyerProfile();
  const [watch] = useWatchlist();
  const [, setTick] = useState(0);

  // Re-run priority calc whenever localStorage emits a state change.
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("tradeline.bank_state.changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("tradeline.bank_state.changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const priority = useMemo<Priority>(() => {
    // 1. Profile empty? — biggest no-friction unlock
    if (!isProfileComplete(profile)) {
      return {
        kind: "profile-empty",
        title: "Fill your buyer profile",
        detail:
          "Auto-fills every broker email, AI tutor context, and playbook script. Takes 2 minutes, saves hours.",
        cta: { label: "Fill profile →", href: "/app/profile" },
        tone: "action",
      };
    }

    // 2. License expiring ≤30 days = urgent legal exposure
    type License = { state: string; expirationDate: string; licenseType: string };
    const licenses = readJSON<License[]>(STORAGE.licenses, []);
    const expiringSoon = licenses
      .map((l) => ({ ...l, daysLeft: daysUntilDate(l.expirationDate) }))
      .filter((l) => l.daysLeft >= 0 && l.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    if (expiringSoon[0]) {
      const l = expiringSoon[0];
      return {
        kind: "license-expiring",
        title: `Renew your ${l.state} ${l.licenseType.toLowerCase()} license`,
        detail: `Expires in ${l.daysLeft} days. Most states take 30–60 days to process renewals — start the paperwork today.`,
        cta: { label: "Open Compliance →", href: "/app/compliance" },
        tone: "urgent",
      };
    }

    // 3. Outreach queued in today's inbox — connect the next-action engine
    // to the daily Approval Inbox so the surfaced action matches what's
    // actually waiting one scroll below.
    if (outreachProposalIds.length > 0) {
      const decisions = readJSON<ApprovalState>(STORAGE.approvalState, {});
      const pending = outreachProposalIds.filter((id) => !decisions[id]);
      if (pending.length > 0) {
        const total = outreachProposalIds.length;
        const done = total - pending.length;
        return {
          kind: "outreach-queued",
          title:
            done === 0
              ? `Send today's first outreach (${total} queued)`
              : `Send next outreach — ${done}/${total} done today`,
          detail:
            "The inbox below has personalized drafts ready for each distressed bank — profile auto-fills your firm details. Approve and ship; replies land in your inbox.",
          cta: { label: "Open inbox →", href: "/app/today#inbox" },
          tone: "action",
        };
      }
    }

    // 4. Outreach follow-up at 7–14 days (read outreach log directly here since hook needs ticker)
    type OutEvent = { ticker: string; brokerShortName: string; sentAt: string };
    const outreach = readJSON<OutEvent[]>("tradeline.bank_outreach_log.v1", []);
    const followUp = outreach
      .map((e) => ({ ...e, days: daysSince(e.sentAt) }))
      .filter((e) => e.days >= 7 && e.days <= 14)
      .sort((a, b) => b.days - a.days);
    if (followUp[0]) {
      const f = followUp[0];
      return {
        kind: "outreach-follow-up",
        title: `Send follow-up to ${f.brokerShortName} about ${f.ticker}`,
        detail: `You emailed ${f.days} days ago and haven't heard back. The pre-filled follow-up template lives on the bank detail page.`,
        cta: { label: `Open ${f.ticker} playbook →`, href: `/app/banks/${f.ticker}` },
        tone: "action",
      };
    }

    // 4. Stale deal in pipeline (5+ days, active stage)
    const deals = readDeals();
    const stale = deals
      .filter((d) => !["won", "lost", "walked", "sourced"].includes(d.stage))
      .map((d) => ({ ...d, days: daysSince(d.updatedAt) }))
      .filter((d) => d.days >= 5)
      .sort((a, b) => b.days - a.days);
    if (stale[0]) {
      const s = stale[0];
      return {
        kind: "stale-deal",
        title: `Move ${s.ticker} forward in pipeline`,
        detail: `Hasn't been updated in ${s.days} days. Stage: ${s.stage} · broker: ${s.brokerName}. Either advance it or mark walked.`,
        cta: { label: "Open Pipeline →", href: "/app/pipeline" },
        tone: "action",
      };
    }

    // 5. At-risk customer
    type Customer = {
      orgName: string;
      lastActivityAt?: string;
      status: string;
      mrrUsd: number;
    };
    const customers = readJSON<Customer[]>(STORAGE.customers, []);
    const atRisk = customers
      .filter((c) => c.status === "active" && c.lastActivityAt)
      .map((c) => ({ ...c, days: daysSince(c.lastActivityAt!) }))
      .filter((c) => c.days >= 14)
      .sort((a, b) => b.days - a.days);
    if (atRisk[0]) {
      const c = atRisk[0];
      return {
        kind: "at-risk-customer",
        title: `Check in with ${c.orgName}`,
        detail: `Inactive ${c.days} days on a paid plan ($${c.mrrUsd}/mo). One personal email today beats losing them next month.`,
        cta: { label: "Open Customers →", href: "/app/customers" },
        tone: "urgent",
      };
    }

    // 6. Watchlisted bank turned green
    const watchedStrong = strongBanks.find((b) => watch.includes(b.ticker));
    if (watchedStrong) {
      return {
        kind: "watchlist-green",
        title: `${watchedStrong.ticker} went green — your watchlist hit`,
        detail: `${watchedStrong.name}. ${watchedStrong.signalLabel || "Strong signal"}. This is what you were waiting for.`,
        cta: { label: `Open ${watchedStrong.ticker} →`, href: `/app/banks/${watchedStrong.ticker}` },
        tone: "action",
      };
    }

    // 7. Just a green bank to act on
    if (strongBanks[0]) {
      const b = strongBanks[0];
      return {
        kind: "green-bank",
        title: `Email a broker about ${b.ticker}`,
        detail: `${b.name}. ${b.signalLabel || "Strong signal"}. The 4-step playbook auto-fills your outreach from your profile.`,
        cta: { label: `Open ${b.ticker} →`, href: `/app/banks/${b.ticker}` },
        tone: "action",
      };
    }

    // 8. Truly nothing
    return {
      kind: "all-clear",
      title: "Quiet morning. Use it.",
      detail:
        "Nothing urgent. Read the playbook, rehearse a call with the AI tutor, or expand the seed list to find new banks the scanner can track.",
      cta: { label: "Ask the tutor →", href: "/app/tutor" },
      tone: "neutral",
    };
  }, [profile, watch, strongBanks]);

  const isUrgent = priority.tone === "urgent";
  const isAction = priority.tone === "action";

  return (
    <section className="mb-8">
      <div
        className="relative rounded-2xl p-6 md:p-8"
        style={
          isUrgent
            ? {
                background:
                  "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, linear-gradient(135deg, var(--color-danger), var(--color-warn)) border-box",
                border: "1.5px solid transparent",
              }
            : isAction
              ? {
                  background:
                    "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                  border: "1.5px solid transparent",
                }
              : undefined
        }
      >
        {!isUrgent && !isAction && (
          <div className="absolute inset-0 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] pointer-events-none" />
        )}
        <div className="relative">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase mb-4">
            <span
              className="px-2 py-0.5 rounded-full text-[#1a0c00] font-semibold"
              style={{
                background: isUrgent
                  ? "linear-gradient(135deg, var(--color-danger), var(--color-warn))"
                  : "var(--gradient-primary)",
              }}
            >
              {isUrgent ? "Do this first" : isAction ? "Today's priority" : "Right now"}
            </span>
            <span className="text-[color:var(--color-fg-faint)]">
              · synthesized from your profile + pipeline + radar
            </span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-[1.05] text-[color:var(--color-fg)]">
            {priority.title}
          </h2>
          <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-3xl">
            {priority.detail}
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Link href={priority.cta.href} className="btn-primary">
              {priority.cta.label}
            </Link>
            <Link
              href="/app/tutor"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Ask the AI ↗
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
