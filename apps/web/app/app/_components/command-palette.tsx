"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Cmd = {
  label: string;
  hint?: string;
  href: string;
  group: string;
  keywords?: string;
};

const COMMANDS: Cmd[] = [
  // Daily flow
  { label: "Today", hint: "Morning watch list", href: "/app/today", group: "Daily", keywords: "home dashboard" },
  { label: "Banks", hint: "All 31 tracked banks", href: "/app/banks", group: "Daily", keywords: "originators" },
  { label: "News", hint: "Headlines matched to your banks", href: "/app/news", group: "Daily" },

  // Workflow
  { label: "Pipeline", hint: "Deals being evaluated", href: "/app/pipeline", group: "Workflow", keywords: "deals" },
  { label: "Portfolio", hint: "Debt you own", href: "/app/portfolio", group: "Workflow", keywords: "owned holdings" },
  { label: "Capital", hint: "Allocation playbook", href: "/app/capital", group: "Workflow", keywords: "money invest" },
  { label: "Compliance", hint: "Licenses + bonds", href: "/app/compliance", group: "Workflow", keywords: "license bond regulatory" },

  // Tools
  { label: "Tape copilot", hint: "Drop a CSV, get aggregates", href: "/app/tools/tape", group: "Tools", keywords: "evaluate bid" },
  { label: "Bid calculator", hint: "NPV math at target IRR", href: "/app/tools/bid-calculator", group: "Tools" },
  { label: "Playbook", hint: "Closing scripts + emails", href: "/app/playbook", group: "Tools", keywords: "scripts sales" },
  { label: "Tradeline AI", hint: "Operator assistant · web search · knows everything", href: "/app/tutor", group: "Tools", keywords: "help chat ai assistant tutor claude research search" },

  // Ecosystem
  { label: "Brokers", hint: "9 major US debt brokers", href: "/app/brokers", group: "Ecosystem" },
  { label: "Lenders", hint: "10 hypothecation partners", href: "/app/lenders", group: "Ecosystem", keywords: "leverage" },
  { label: "Servicers", hint: "Third-party collectors", href: "/app/servicers", group: "Ecosystem" },

  // Business
  { label: "Customers", hint: "Buy-side CRM", href: "/app/customers", group: "Business", keywords: "saas users" },
  { label: "Subscribers", hint: "Supply-side marketplace", href: "/app/subscribers", group: "Business" },
  { label: "Marketplace", hint: "Public landing for brokers/lenders", href: "/app/marketplace", group: "Business" },
  { label: "Intel", hint: "Competitive landscape", href: "/app/intel", group: "Business", keywords: "competitors" },
  { label: "Track record", hint: "Predictions vs reality", href: "/app/intel/track-record", group: "Business", keywords: "hit rate" },

  // Start here
  { label: "Path A — Go Live (sell Tradeline)", hint: "4 steps, one day, real revenue", href: "/app/launch", group: "Start here", keywords: "launch deploy sell saas vercel" },
  { label: "Path B — Winning System (become a buyer)", hint: "21 steps, 12 months, opinionated", href: "/app/path", group: "Start here", keywords: "winning system path guide tour buyer license" },
  { label: "Your buyer profile", hint: "Fill once, auto-fills every email + script", href: "/app/profile", group: "Start here", keywords: "profile buyer firm license bond servicer signature template autofill" },
  { label: "How this works", hint: "Beginner's guide", href: "/app/learn", group: "Start here", keywords: "learn intro tutorial" },
  { label: "Setup hub", hint: "19-item checklist", href: "/app/setup", group: "Start here", keywords: "onboarding" },
  { label: "State licensing", hint: "VA/MD/NC/GA playbooks", href: "/app/setup/license", group: "Start here", keywords: "license bond" },
  { label: "Service providers", hint: "Who to hire", href: "/app/setup/providers", group: "Start here", keywords: "vendors registered agent surety insurance attorney cpa" },
  { label: "Fund formation", hint: "5-year path to fund manager", href: "/app/setup/fund", group: "Start here" },
  { label: "Vision & roadmap", hint: "Where this is going", href: "/app/roadmap", group: "Start here" },
  { label: "Public report landing", hint: "31-bank weekly", href: "/report", group: "Start here", keywords: "public marketing" },
];

const GROUP_ORDER = [
  "Daily",
  "Workflow",
  "Tools",
  "Ecosystem",
  "Business",
  "Start here",
];

function fuzzyMatch(haystack: string, needle: string): number {
  // Simple ranker: exact match > prefix > word-start > substring > letter overlap
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 1;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500;
  const words = h.split(/[\s/-]+/);
  if (words.some((w) => w.startsWith(n))) return 300;
  if (h.includes(n)) return 100;
  // Letter sequence: every letter of needle appears in order in haystack
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return 10;
  }
  return 0;
}

function scoreCmd(cmd: Cmd, q: string): number {
  if (!q) return 1;
  const target = `${cmd.label} ${cmd.hint || ""} ${cmd.keywords || ""}`;
  return fuzzyMatch(target, q);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const ranked = useMemo(() => {
    const withScores = COMMANDS.map((c) => ({ cmd: c, score: scoreCmd(c, query) }));
    return withScores
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [ranked.length]);

  function go(cmd: Cmd) {
    setOpen(false);
    router.push(cmd.href as never);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, ranked.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = ranked[activeIndex];
      if (active) go(active.cmd);
    }
  }

  // Group filtered results
  const grouped = useMemo(() => {
    const out: Record<string, Cmd[]> = {};
    for (const r of ranked) {
      const g = r.cmd.group;
      if (!out[g]) out[g] = [];
      out[g].push(r.cmd);
    }
    return out;
  }, [ranked]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 fixed bottom-6 right-6 z-30 px-4 py-2.5 bg-[color:var(--color-bg-1)] border border-[color:var(--color-line-strong)] rounded-lg shadow-[var(--shadow-elevated)] hover:border-[color:var(--color-accent)] transition text-[13px] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
        aria-label="Open command palette"
      >
        <span>Quick nav</span>
        <span className="kbd">⌘K</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] pb-6 bg-black/60 backdrop-blur-sm overflow-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl card-elevated overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-line)]">
          <span className="text-[color:var(--color-fg-faint)] text-[15px]">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump anywhere…"
            className="flex-1 bg-transparent border-0 outline-none text-[15px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus-visible:outline-none"
            style={{ outline: "none" }}
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {ranked.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-[color:var(--color-fg-faint)]">
              No matches. Try a different term.
            </div>
          ) : (
            GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
              <div key={group} className="mb-2 last:mb-0">
                <div className="px-4 py-1.5 eyebrow">{group}</div>
                <ul>
                  {grouped[group].map((cmd) => {
                    const flatIndex = ranked.findIndex((r) => r.cmd.href === cmd.href);
                    const active = flatIndex === activeIndex;
                    return (
                      <li key={cmd.href}>
                        <button
                          type="button"
                          onClick={() => go(cmd)}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                            active
                              ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-fg)]"
                              : "text-[color:var(--color-fg)] hover:bg-[color:var(--color-bg-2)]"
                          }`}
                        >
                          <span
                            className={`text-[14px] flex-1 truncate ${
                              active ? "text-[color:var(--color-accent)]" : ""
                            }`}
                          >
                            {cmd.label}
                          </span>
                          {cmd.hint && (
                            <span className="text-[12px] text-[color:var(--color-fg-faint)] truncate max-w-[55%]">
                              {cmd.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[11px] text-[color:var(--color-fg-faint)]">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑↓</span> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">esc</span> close
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            Open anywhere with <span className="kbd">⌘K</span>
          </span>
        </div>
      </div>

      {/* Hidden link to assist focus management */}
      <Link href="/app/today" className="sr-only">
        home
      </Link>
    </div>
  );
}
