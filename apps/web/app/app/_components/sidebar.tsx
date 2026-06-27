"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import {
  expiredLicenses,
  expiringWithinDays,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
} from "@/lib/compliance-licenses";

type NavItem = {
  href: string;
  label: string;
  soon?: boolean;
  icon?: string;
  isNew?: boolean;
};

type NavSection = {
  label: string;
  accent?: "green" | "blue" | "purple" | "amber" | "neutral";
  items: NavItem[];
  /** When true, the section is rendered inside a <details> collapsed by
   * default. Keeps the sidebar workbase-like: ~5 items always visible, the
   * rest one click away. */
  collapsed?: boolean;
};

const SECTIONS: NavSection[] = [
  {
    label: "Workbase",
    accent: "green",
    items: [
      { href: "/app/today", label: "Today", icon: "☀" },
      { href: "/app/inbox/tapes", label: "Tape inbox", icon: "✉", isNew: true },
      { href: "/app/inbox/replies", label: "Replies", icon: "↩", isNew: true },
      { href: "/app/inbox/do-not-contact", label: "Do not contact", icon: "⊘" },
      { href: "/app/broker", label: "Broker", icon: "⇄", isNew: true },
      { href: "/app/autopilot", label: "Autopilot", icon: "↻", isNew: true },
      { href: "/app/growth", label: "Growth engine", icon: "✺", isNew: true },
      { href: "/app/progress", label: "Progress", icon: "▲" },
      { href: "/app/pipeline", label: "Pipeline", icon: "→" },
      { href: "/app/customers", label: "Customers", icon: "◐" },
      { href: "/app/tutor", label: "Tradeline AI", icon: "✦" },
    ],
  },
  {
    label: "Setup",
    accent: "amber",
    collapsed: true,
    items: [
      { href: "/app/welcome", label: "Welcome wizard", icon: "✦" },
      { href: "/app/profile", label: "Your profile", icon: "◧" },
      { href: "/app/launch", label: "Path A · Sell", icon: "→" },
      { href: "/app/path", label: "Path B · Buy", icon: "★" },
      { href: "/app/deploy", label: "Deploy progress", icon: "↗" },
      { href: "/app/learn", label: "How this works", icon: "◍" },
    ],
  },
  {
    label: "Radar",
    accent: "blue",
    collapsed: true,
    items: [
      { href: "/app/banks", label: "Banks", icon: "▦" },
      { href: "/app/banks/discovered", label: "Discovered", icon: "◈" },
      { href: "/app/news", label: "News", icon: "▤" },
    ],
  },
  {
    label: "Operations",
    accent: "amber",
    collapsed: true,
    items: [
      { href: "/app/portfolio", label: "Portfolio", icon: "◉" },
      { href: "/app/capital", label: "Capital", icon: "$" },
      { href: "/app/compliance", label: "Compliance", icon: "§" },
    ],
  },
  {
    label: "Tools",
    accent: "purple",
    collapsed: true,
    items: [
      { href: "/app/tools/tape", label: "Tape copilot", icon: "◎" },
      { href: "/app/tools/bid-calculator", label: "Bid calculator", icon: "≡" },
      { href: "/app/playbook", label: "Playbook", icon: "✎" },
    ],
  },
  {
    label: "Business",
    accent: "neutral",
    collapsed: true,
    items: [
      { href: "/app/referrals", label: "Referral desk", icon: "⇄" },
      { href: "/app/subscribers", label: "Subscribers", icon: "◑" },
      { href: "/app/report-leads", label: "Report leads", icon: "✉" },
      { href: "/app/billing", label: "Billing", icon: "$" },
      { href: "/app/marketplace", label: "Marketplace", icon: "◇" },
      { href: "/app/intel", label: "Intel", icon: "✧" },
    ],
  },
];

const ACCENT_DOT: Record<NonNullable<NavSection["accent"]>, string> = {
  green: "bg-[color:var(--color-accent)]",
  blue: "bg-[color:var(--color-accent-2)]",
  purple: "bg-[color:var(--color-accent-3)]",
  amber: "bg-[color:var(--color-warn)]",
  neutral: "bg-[color:var(--color-fg-faint)]",
};

const MOBILE_NAV: NavItem[] = [
  { href: "/app/today", label: "Today" },
  { href: "/app/banks", label: "Banks" },
  { href: "/app/pipeline", label: "Pipeline" },
  { href: "/app/setup", label: "Setup" },
  { href: "/app/tutor", label: "Help" },
];

export function Sidebar({ generatedAt }: { generatedAt: string }) {
  const pathname = usePathname() || "";
  const [profile] = useBuyerProfile();
  const profileComplete = isProfileComplete(profile);

  // Compliance urgency badge: count of expired + urgent-expiring licenses.
  // Reads from localStorage on mount + when storage changes (so adding a
  // new license at /app/compliance immediately updates the badge here).
  const [complianceUrgent, setComplianceUrgent] = useState<{
    expired: number;
    expiringUrgent: number;
  }>({ expired: 0, expiringUrgent: 0 });
  useEffect(() => {
    function recompute() {
      const licenses = readLicenses();
      setComplianceUrgent({
        expired: expiredLicenses(licenses).length,
        expiringUrgent: expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS).length,
      });
    }
    recompute();
    function onStorage(e: StorageEvent) {
      if (e.key === "tradeline.compliance.licenses.v1" || e.key === null) recompute();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const complianceUrgentTotal = complianceUrgent.expired + complianceUrgent.expiringUrgent;

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)]">
      <Link
        href="/"
        className="flex items-center gap-3 px-5 py-5 border-b border-[color:var(--color-line)] hover:opacity-90 transition group"
      >
        <span
          className="h-9 w-9 rounded-xl flex items-center justify-center text-[#0a0c14] font-bold text-[18px] shadow-[0_8px_22px_-6px_rgba(var(--tint-accent-rgb),0.55)] group-hover:shadow-[0_10px_26px_-4px_rgba(var(--tint-accent-rgb),0.75)] transition-shadow"
          style={{ background: "var(--gradient-primary)" }}
        >
          T
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-[20px] tracking-tight text-gradient-accent">
            Tradeline
          </span>
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Debt-buyer OS
          </span>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section, idx) => {
          // Auto-expand collapsed sections when the user is on a route inside
          // them, so deep links don't make the active item invisible.
          const hasActive = section.items.some(
            (n) =>
              pathname === n.href ||
              (n.href !== "/app/today" && pathname.startsWith(n.href))
          );
          const SectionWrapper = section.collapsed ? "details" : "div";
          const sectionProps =
            section.collapsed && hasActive ? { open: true } : section.collapsed ? {} : {};
          const SummaryOrDiv = section.collapsed ? "summary" : "div";
          const headerClass = section.collapsed
            ? "flex items-center gap-2 px-2 pb-2 cursor-pointer list-none select-none group/sec hover:text-[color:var(--color-accent)] transition"
            : "flex items-center gap-2 px-2 pb-2";
          return (
            <SectionWrapper
              key={section.label}
              className={idx > 0 ? "mt-6" : ""}
              {...sectionProps}
            >
              <SummaryOrDiv className={headerClass}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[section.accent || "neutral"]}`}
                />
                <span className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] group-hover/sec:text-[color:var(--color-accent)]">
                  {section.label}
                </span>
                {section.collapsed && (
                  <span className="ml-auto text-[10px] text-[color:var(--color-fg-faint)] group-open/sec:rotate-180 transition-transform">
                    ▾
                  </span>
                )}
              </SummaryOrDiv>
              <ul className="space-y-0.5">
              {section.items.map((n) => {
                const active =
                  pathname === n.href ||
                  (n.href !== "/app/today" && pathname.startsWith(n.href));
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`group relative flex items-center justify-between gap-3 px-3 py-2 text-[14px] rounded-lg transition overflow-hidden ${
                        active
                          ? "text-[color:var(--color-fg)]"
                          : "text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-2)] hover:text-[color:var(--color-fg)]"
                      }`}
                      style={
                        active
                          ? { background: "var(--gradient-primary-soft)" }
                          : undefined
                      }
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                          style={{ background: "var(--gradient-primary)" }}
                        />
                      )}
                      <span className="flex items-center gap-3 min-w-0">
                        {n.icon && (
                          <span
                            className={`w-4 text-center text-[14px] shrink-0 ${
                              active
                                ? "text-[color:var(--color-accent)]"
                                : "text-[color:var(--color-fg-faint)] group-hover:text-[color:var(--color-fg-dim)]"
                            }`}
                          >
                            {n.icon}
                          </span>
                        )}
                        <span className="truncate">{n.label}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {n.isNew && (
                          <span
                            className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-full text-[#0a0c14] font-semibold"
                            style={{ background: "var(--gradient-primary)" }}
                          >
                            New
                          </span>
                        )}
                        {n.soon && (
                          <span className="text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                            Soon
                          </span>
                        )}
                        {n.href === "/app/profile" && (
                          <span
                            aria-hidden
                            title={
                              profileComplete
                                ? "Profile complete"
                                : "Profile incomplete — fill once to auto-fill everywhere"
                            }
                            className={`h-2 w-2 rounded-full ${
                              profileComplete
                                ? "bg-[color:var(--color-success)] glow"
                                : "bg-[color:var(--color-warn)]"
                            }`}
                          />
                        )}
                        {n.href === "/app/compliance" && complianceUrgentTotal > 0 && (
                          <span
                            title={
                              complianceUrgent.expired > 0
                                ? `${complianceUrgent.expired} expired, ${complianceUrgent.expiringUrgent} expiring soon`
                                : `${complianceUrgent.expiringUrgent} expiring in <${URGENT_EXPIRY_THRESHOLD_DAYS}d`
                            }
                            className="font-mono text-[9px] tracking-[0.05em] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{
                              background:
                                complianceUrgent.expired > 0
                                  ? "var(--color-danger)"
                                  : "var(--color-warn)",
                              color: "var(--color-bg)",
                            }}
                          >
                            {complianceUrgentTotal}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            </SectionWrapper>
          );
        })}

        <div className="mt-8 px-2 space-y-2">
          <Link
            href="/app/roadmap"
            className={`flex items-center justify-between px-3 py-2 text-[13px] rounded-md transition border ${
              pathname.startsWith("/app/roadmap")
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            <span>Vision & roadmap</span>
            <span className="text-[color:var(--color-fg-faint)]">→</span>
          </Link>
          <Link
            href="/report"
            className="flex items-center justify-between px-3 py-2 text-[13px] rounded-md transition text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-2)] hover:text-[color:var(--color-fg)]"
          >
            <span>Public report ↗</span>
          </Link>
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-[color:var(--color-line)]">
        <div className="rounded-xl bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-3 py-2.5 flex items-center gap-2.5">
          <span className="relative flex shrink-0">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)] glow" />
            <span className="absolute inset-0 h-2 w-2 rounded-full bg-[color:var(--color-success)] animate-ping opacity-40" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[color:var(--color-fg)] leading-tight">
              Systems operational
            </div>
            <div className="text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.04em] truncate">
              {generatedAt
                ? `Radar · ${generatedAt.replace("T", " ").slice(11, 16)} UTC`
                : "Radar · idle"}
            </div>
          </div>
          <span className="kbd shrink-0">⌘K</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileTabs() {
  const pathname = usePathname() || "";
  return (
    <nav className="md:hidden flex border-b border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] sticky top-0 z-20 overflow-x-auto">
      {MOBILE_NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 min-w-[80px] text-center py-3 font-mono text-[11px] tracking-[0.15em] uppercase transition ${
              active
                ? "text-[color:var(--color-accent)] border-b-2 border-[color:var(--color-accent)]"
                : "text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg-dim)]"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
