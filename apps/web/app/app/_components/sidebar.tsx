"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

type NavItem = { href: string; label: string; soon?: boolean; icon?: string };

type NavSection = {
  label: string;
  accent?: "green" | "blue" | "purple" | "amber" | "neutral";
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: "Start here",
    accent: "green",
    items: [
      { href: "/app/launch", label: "Path A · Sell", icon: "→" },
      { href: "/app/path", label: "Path B · Buy", icon: "★" },
      { href: "/app/profile", label: "Your profile", icon: "◧" },
      { href: "/app/learn", label: "How this works", icon: "◍" },
      { href: "/app/tutor", label: "Ask the tutor", icon: "✦" },
    ],
  },
  {
    label: "Daily",
    accent: "blue",
    items: [
      { href: "/app/today", label: "Today", icon: "☀" },
      { href: "/app/banks", label: "Banks", icon: "▦" },
      { href: "/app/news", label: "News", icon: "▤" },
    ],
  },
  {
    label: "Workflow",
    accent: "amber",
    items: [
      { href: "/app/pipeline", label: "Pipeline", icon: "→" },
      { href: "/app/portfolio", label: "Portfolio", icon: "◉" },
      { href: "/app/capital", label: "Capital", icon: "$" },
      { href: "/app/compliance", label: "Compliance", icon: "§" },
    ],
  },
  {
    label: "Tools",
    accent: "purple",
    items: [
      { href: "/app/tools/tape", label: "Tape copilot", icon: "◎" },
      { href: "/app/tools/bid-calculator", label: "Bid calculator", icon: "≡" },
      { href: "/app/playbook", label: "Playbook", icon: "✎" },
    ],
  },
  {
    label: "Business",
    accent: "neutral",
    items: [
      { href: "/app/customers", label: "Customers", icon: "◐" },
      { href: "/app/subscribers", label: "Subscribers", icon: "◑" },
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

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)]">
      <Link
        href="/"
        className="flex items-center gap-3 px-5 py-5 border-b border-[color:var(--color-line)] hover:opacity-90 transition"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-accent)] glow" />
        <span className="font-serif italic text-[20px] text-[color:var(--color-fg)] tracking-tight">
          Tradeline
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? "mt-6" : ""}>
            <div className="flex items-center gap-2 px-2 pb-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[section.accent || "neutral"]}`}
              />
              <span className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                {section.label}
              </span>
            </div>
            <ul className="space-y-0.5">
              {section.items.map((n) => {
                const active =
                  pathname === n.href ||
                  (n.href !== "/app/today" && pathname.startsWith(n.href));
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`group flex items-center justify-between gap-3 px-3 py-2 text-[14px] rounded-md transition ${
                        active
                          ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-fg)]"
                          : "text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-2)] hover:text-[color:var(--color-fg)]"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {n.icon && (
                          <span
                            className={`w-4 text-center text-[14px] ${
                              active
                                ? "text-[color:var(--color-accent)]"
                                : "text-[color:var(--color-fg-faint)] group-hover:text-[color:var(--color-fg-dim)]"
                            }`}
                          >
                            {n.icon}
                          </span>
                        )}
                        <span>{n.label}</span>
                      </span>
                      {n.soon && (
                        <span className="text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                          Soon
                        </span>
                      )}
                      {n.href === "/app/profile" && (
                        <span
                          aria-hidden
                          title={profileComplete ? "Profile complete" : "Profile incomplete — fill once to auto-fill everywhere"}
                          className={`h-2 w-2 rounded-full ${
                            profileComplete
                              ? "bg-[color:var(--color-accent)] glow"
                              : "bg-[color:var(--color-warn)]"
                          }`}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

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

      <div className="px-5 py-3 border-t border-[color:var(--color-line)]">
        <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-fg-faint)]">
          <span className="kbd">⌘K</span>
          <span>quick nav anywhere</span>
        </div>
        <div className="mt-2 text-[10px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          Data refreshed{" "}
          <span className="text-[color:var(--color-fg-dim)]">
            {generatedAt ? generatedAt.replace("T", " ").slice(0, 19) : "never"}
          </span>
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
