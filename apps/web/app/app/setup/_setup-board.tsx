"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CelebrationToast,
  MilestoneBanner,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";

type Stage =
  | "researching"
  | "building-foundation"
  | "applying-license"
  | "first-deal-prep"
  | "scaling";

type ChecklistItem = {
  id: string;
  group: "Legal foundation" | "Financial setup" | "Operational" | "Relationships" | "First deal";
  label: string;
  detail: string;
  href?: string;
};

const CHECKLIST: ChecklistItem[] = [
  // ── Legal foundation ──────────────────────────────────────────────────
  {
    id: "llc-formed",
    group: "Legal foundation",
    label: "LLC formed",
    detail:
      "Your business entity. Pick a state — Wyoming or Delaware are popular for privacy and asset protection; your home state is simpler. Northwest Registered Agent can do this for ~$200.",
    href: "/app/setup/providers#ein-formation",
  },
  {
    id: "ein-issued",
    group: "Legal foundation",
    label: "EIN issued",
    detail:
      "Federal tax ID. Free at irs.gov/ein. Takes 10 minutes online if you're a US citizen with an SSN. Required before any bank account.",
    href: "https://www.irs.gov/businesses/employer-identification-number",
  },
  {
    id: "registered-agent",
    group: "Legal foundation",
    label: "Registered agent in formation state",
    detail:
      "A required mailing address for legal notices. Most LLC-formation services include the first year. Northwest is the standard.",
    href: "/app/setup/providers#registered-agent",
  },
  {
    id: "operating-agreement",
    group: "Legal foundation",
    label: "LLC operating agreement signed",
    detail:
      "Internal document defining how the LLC is owned and run. Even if you're a single-member LLC, your bank and surety carrier will ask for it. Free templates online; formation services include one.",
  },

  // ── Financial setup ───────────────────────────────────────────────────
  {
    id: "business-bank",
    group: "Financial setup",
    label: "Business bank account opened",
    detail:
      "Mercury or Relay — fully remote, no branch visit, no monthly fees. Apply with your EIN and operating agreement.",
    href: "/app/setup/providers#bank",
  },
  {
    id: "starting-capital",
    group: "Financial setup",
    label: "Starting capital deposited ($25k+ recommended)",
    detail:
      "Your first deal will be small ($5–15k purchase price), but you need $25k+ in the account to demonstrate operating capacity to surety carriers, brokers, and lenders.",
  },
  {
    id: "ein-bookkeeping",
    group: "Financial setup",
    label: "Bookkeeping set up (QuickBooks / Wave / Xero)",
    detail:
      "QuickBooks Online is the standard. Mercury exports cleanly to it. CPA will want clean books from day 1 — not retrofit later.",
  },
  {
    id: "cpa-engaged",
    group: "Financial setup",
    label: "CPA engaged (receivables specialty)",
    detail:
      "Look for a CPA with experience in specialty finance / receivables. Generic CPAs don't know mark-to-market for debt portfolios.",
    href: "/app/setup/providers#cpa",
  },

  // ── Operational ───────────────────────────────────────────────────────
  {
    id: "ein-attorney",
    group: "Operational",
    label: "Consumer-finance attorney on retainer",
    detail:
      "Even if you only call them quarterly. Reviews your contracts, advises on FCRA/FDCPA/Reg F, defends class actions if they come.",
    href: "/app/setup/providers#attorney",
  },
  {
    id: "ein-insurance",
    group: "Operational",
    label: "E&O insurance bound",
    detail:
      "Required by most servicers. $1M minimum coverage; $300–$1,500/yr from Hiscox. Get the receivables-management endorsement.",
    href: "/app/setup/providers#insurance",
  },
  {
    id: "first-state-license",
    group: "Operational",
    label: "First-state license filed (or confirmed not needed)",
    detail:
      "If you're using a third-party servicer in Georgia, you may not need a license at all. Otherwise, file in one state to start. See the State Playbook.",
    href: "/app/setup/license",
  },
  {
    id: "surety-bond",
    group: "Operational",
    label: "Surety bond posted (if state requires)",
    detail:
      "Quote from Surety Bonds Direct or JW Surety. They run your credit and net-worth. Premium is typically 1–3% of the bond amount.",
    href: "/app/setup/providers#surety-bond",
  },

  // ── Relationships ─────────────────────────────────────────────────────
  {
    id: "servicer-msa",
    group: "Relationships",
    label: "Master servicing agreement signed",
    detail:
      "Pick one servicer to start (NCB Management or JH Portfolio for credit card; Plaza for mortgage). MSA negotiation is the slowest part — start early.",
    href: "/app/servicers",
  },
  {
    id: "broker-profile",
    group: "Relationships",
    label: "Buyer profile PDF prepared",
    detail:
      "One-page intro: your firm, license status, bond, capital, servicer, asset-class focus. The first thing a broker asks for.",
  },
  {
    id: "broker-introductions",
    group: "Relationships",
    label: "First broker introductions made (3+)",
    detail:
      "Email or LinkedIn-message your buyer profile to 3 brokers. Don't ask for tapes — ask to be on their list. Garnet, RMG, IndustryUp are good starting points.",
    href: "/app/brokers",
  },
  {
    id: "rmai-evaluated",
    group: "Relationships",
    label: "RMAI membership evaluated ($1,500–$5,000/yr)",
    detail:
      "Receivables Management Association International. Industry trade group. Annual conference is where most relationships start. Worth it once you're operational; not before.",
    href: "https://www.rmaintl.org/",
  },

  // ── First deal ────────────────────────────────────────────────────────
  {
    id: "first-tape-evaluated",
    group: "First deal",
    label: "First tape evaluated (using Tape Copilot)",
    detail:
      "Drop a CSV from a broker into Tradeline's Tape Copilot. See the aggregates and bid range. Even if you don't bid, learn how the math works.",
    href: "/app/tools/tape",
  },
  {
    id: "first-bid-submitted",
    group: "First deal",
    label: "First bid submitted",
    detail:
      "Use the playbook bid-submission email template. Be specific. Hold price; don't chase if you lose.",
    href: "/app/playbook",
  },
  {
    id: "first-deal-closed",
    group: "First deal",
    label: "First deal closed and funded",
    detail:
      "Wire the money. Get the tape. Send to your servicer. Log in Tradeline's Pipeline → Won, then in Portfolio.",
  },
];

const STAGE_DESCRIPTION: Record<Stage, { title: string; subtitle: string; focus: string[] }> = {
  researching: {
    title: "Researching the business",
    subtitle:
      "You're learning what this is and whether it's for you. The bar to clear is understanding the math, not getting licensed.",
    focus: [
      "Read /app/learn end to end",
      "Browse /app/today to see what radar signals look like in practice",
      "Run hypothetical bids in /app/tools/bid-calculator",
      "Decide: do I want to actually do this?",
    ],
  },
  "building-foundation": {
    title: "Building your legal & financial foundation",
    subtitle:
      "You've decided to do this. Now form the LLC, open the bank, get the EIN. Mostly forms.",
    focus: [
      "Form LLC + get EIN",
      "Open Mercury/Relay business bank account",
      "Choose your starting state — see /app/setup/license",
      "Get bookkeeping set up",
    ],
  },
  "applying-license": {
    title: "Applying for licenses (or confirming you don't need them)",
    subtitle:
      "If you're using a third-party servicer in GA or VA, you may not need a license at all. Otherwise, file applications.",
    focus: [
      "File first-state collection-agency or debt-buyer license",
      "Post surety bond",
      "Provide fingerprints / background check",
      "Engage attorney + CPA",
      "Get E&O insurance",
    ],
  },
  "first-deal-prep": {
    title: "Preparing for your first deal",
    subtitle:
      "License is in (or not needed). Now build broker relationships, sign the servicer MSA, prep your buyer profile.",
    focus: [
      "Sign master servicing agreement",
      "Prepare buyer profile PDF",
      "Make 3+ broker introductions",
      "Evaluate first 1–3 tapes (just to learn — not necessarily bid)",
    ],
  },
  scaling: {
    title: "Scaling — multiple deals, then leverage",
    subtitle:
      "First deal closed. Now: 3-5 closed deals across different brokers, then approach hypothecation lenders.",
    focus: [
      "Close 3-5 small deals across 2-3 brokers",
      "Track everything in /app/portfolio",
      "Hit 12-month seasoning on first portfolio",
      "Approach hypothecation lenders — see /app/lenders",
      "Run capital allocation calc — see /app/capital",
    ],
  },
};

const CHECKLIST_STORAGE_KEY = "tradeline.setup.checklist.v1";
const STAGE_STORAGE_KEY = "tradeline.setup.stage.v1";

export function SetupBoard() {
  const [stage, setStage] = useState<Stage>("researching");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [milestoneSeen, setMilestoneSeen] = useState(false);
  const celebration = useDoneCelebration();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STAGE_STORAGE_KEY) as Stage | null;
    if (stored && stored in STAGE_DESCRIPTION) setStage(stored);
    const c = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (c) {
      try {
        const arr = JSON.parse(c);
        if (Array.isArray(arr)) setCompleted(new Set(arr));
      } catch {}
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STAGE_STORAGE_KEY, stage);
  }, [stage, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify([...completed])
    );
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
      const item = CHECKLIST.find((c) => c.id === id);
      celebration.trigger(id, `Done · ${item?.label ?? "Setup item"}`);
    }
  };

  const groups = Array.from(new Set(CHECKLIST.map((c) => c.group)));
  const completedCount = completed.size;
  const total = CHECKLIST.length;
  const pct = total === 0 ? 0 : (completedCount / total) * 100;

  if (!hydrated) {
    return (
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
        Loading your setup progress…
      </div>
    );
  }

  const stageInfo = STAGE_DESCRIPTION[stage];

  return (
    <div className="space-y-10">
      {/* Stage selector */}
      <section>
        <SectionLabel>Where are you in the journey?</SectionLabel>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          {(Object.keys(STAGE_DESCRIPTION) as Stage[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`text-left p-3 border transition ${
                stage === s
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-bg-1)] text-[color:var(--color-fg)]"
                  : "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase mb-1">
                Stage{" "}
                {Object.keys(STAGE_DESCRIPTION).indexOf(s) + 1}
              </div>
              <div className="text-[13px] leading-snug">{STAGE_DESCRIPTION[s].title}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
          <h2 className="text-xl font-medium tracking-tight">{stageInfo.title}</h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {stageInfo.subtitle}
          </p>
          <div className="mt-4 font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Focus right now
          </div>
          <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            {stageInfo.focus.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Progress + Checklist */}
      <section>
        <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
          <SectionLabel>Setup checklist · {completedCount} / {total} done</SectionLabel>
          <div className="font-mono text-[12px] text-[color:var(--color-accent)] tick">
            {pct.toFixed(0)}%
          </div>
        </div>
        <div className="h-1.5 bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] overflow-hidden mb-6">
          <div
            className="h-full bg-[color:var(--color-accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-6">
          {groups.map((group) => {
            const items = CHECKLIST.filter((c) => c.group === group);
            const groupDone = items.filter((c) => completed.has(c.id)).length;
            return (
              <div key={group}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-[color:var(--color-fg)]">
                    {group}
                  </div>
                  <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                    {groupDone}/{items.length}
                  </div>
                </div>
                <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
                  {items.map((item) => {
                    const done = completed.has(item.id);
                    const justDone = celebration.isJustDone(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`px-5 py-4 transition ${
                          done ? "bg-[color:var(--color-bg-1)]" : ""
                        } ${justDone ? "animate-row-glow" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggle(item.id)}
                            aria-label={done ? "Mark incomplete" : "Mark complete"}
                            className={`relative mt-1 shrink-0 w-5 h-5 border rounded flex items-center justify-center transition ${
                              done
                                ? "bg-[color:var(--color-success)] border-[color:var(--color-success-dim)] text-[color:var(--color-bg)]"
                                : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)]"
                            } ${justDone ? "animate-check-pop" : ""}`}
                          >
                            {done && (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M11 4L5.5 9.5L3 7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                />
                              </svg>
                            )}
                            {justDone && <SparkleBurst />}
                          </button>
                          <div className="flex-1">
                            <div
                              className={`text-[15px] font-medium ${
                                done
                                  ? "text-[color:var(--color-fg-faint)] line-through"
                                  : "text-[color:var(--color-fg)]"
                              }`}
                            >
                              {item.label}
                            </div>
                            <div
                              className={`mt-1 text-[13px] leading-relaxed ${
                                done
                                  ? "text-[color:var(--color-fg-faint)]"
                                  : "text-[color:var(--color-fg-dim)]"
                              }`}
                            >
                              {item.detail}
                            </div>
                            {item.href && (
                              <Link
                                href={item.href as never}
                                className="mt-2 inline-block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
                              >
                                Open guide &rarr;
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {completedCount === total && !milestoneSeen && (
        <MilestoneBanner
          visible
          label="All 19 setup items checked. You're operational."
          sublabel="Foundation done. Focus moves from setup to deal flow, seasoning, and leverage."
          onDismiss={() => setMilestoneSeen(true)}
        />
      )}
      <CelebrationToast message={celebration.toast} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}
