"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; soon?: boolean };

type NavSection = {
  label: string;
  items: NavItem[];
  accent?: "green" | "blue" | "purple" | "amber" | "neutral";
};

const SECTIONS: NavSection[] = [
  {
    label: "Start here",
    accent: "green",
    items: [
      { href: "/app/learn", label: "How this works" },
      { href: "/app/setup", label: "Setup hub" },
      { href: "/app/tutor", label: "AI tutor" },
    ],
  },
  {
    label: "Market intelligence",
    accent: "blue",
    items: [
      { href: "/app/today", label: "Today" },
      { href: "/app/banks", label: "Banks" },
      { href: "/app/news", label: "News" },
    ],
  },
  {
    label: "Ecosystem",
    accent: "purple",
    items: [
      { href: "/app/brokers", label: "Brokers" },
      { href: "/app/lenders", label: "Lenders" },
      { href: "/app/servicers", label: "Servicers" },
    ],
  },
  {
    label: "Operations",
    accent: "amber",
    items: [
      { href: "/app/pipeline", label: "Pipeline" },
      { href: "/app/portfolio", label: "Portfolio" },
      { href: "/app/capital", label: "Capital" },
      { href: "/app/compliance", label: "Compliance" },
    ],
  },
  {
    label: "Marketplace",
    accent: "purple",
    items: [
      { href: "/app/marketplace", label: "Public landing" },
      { href: "/app/subscribers", label: "Subscribers" },
    ],
  },
  {
    label: "Business",
    accent: "neutral",
    items: [
      { href: "/app/customers", label: "Customers" },
      { href: "/app/intel", label: "Intel" },
    ],
  },
  {
    label: "Tools",
    accent: "neutral",
    items: [
      { href: "/app/tools/tape", label: "Tape copilot" },
      { href: "/app/tools/bid-calculator", label: "Bid calculator" },
      { href: "/app/playbook", label: "Playbook" },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/app/today", label: "Today" },
  { href: "/app/banks", label: "Banks" },
  { href: "/app/learn", label: "Learn" },
  { href: "/app/playbook", label: "Playbook" },
];

const ACCENT_DOT: Record<NonNullable<NavSection["accent"]>, string> = {
  green: "bg-[color:var(--color-accent)]",
  blue: "bg-[color:var(--color-accent-2)]",
  purple: "bg-[color:var(--color-accent-3)]",
  amber: "bg-[color:var(--color-warn)]",
  neutral: "bg-[color:var(--color-fg-faint)]",
};

export function Sidebar({ generatedAt }: { generatedAt: string }) {
  const pathname = usePathname() || "";

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)]">
      <Link
        href="/"
        className="flex items-center gap-3 px-6 py-6 border-b border-[color:var(--color-line)] hover:opacity-90 transition"
      >
        <span className="h-2 w-2 rounded-full bg-[color:var(--color-accent)] glow" />
        <span className="font-serif italic text-[20px] text-[color:var(--color-fg)] tracking-tight">
          Tradeline
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? "mt-6" : ""}>
            <div className="flex items-center gap-2 px-3 pb-2 text-[11px] tracking-[0.04em] text-[color:var(--color-fg-faint)]">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${ACCENT_DOT[section.accent || "neutral"]}`}
              />
              {section.label}
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
                      className={`flex items-center justify-between px-3 py-2 text-[14px] rounded-md transition ${
                        active
                          ? "bg-[color:var(--color-bg-2)] text-[color:var(--color-fg)] shadow-[inset_2px_0_0_var(--color-accent)]"
                          : "text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-2)]/60 hover:text-[color:var(--color-fg)]"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.soon && (
                        <span className="text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] font-mono">
                          Soon
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-8 px-3">
          <Link
            href="/app/roadmap"
            className={`flex items-center justify-between px-3 py-2.5 text-[13px] rounded-md border transition ${
              pathname.startsWith("/app/roadmap")
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            <span className="font-serif italic">Vision &amp; roadmap</span>
            <span className="text-[color:var(--color-fg-faint)]">&rarr;</span>
          </Link>
        </div>
      </nav>

      <div className="px-6 py-4 border-t border-[color:var(--color-line)]">
        <div className="text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
          Data refreshed
        </div>
        <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-dim)]">
          {generatedAt ? generatedAt.replace("T", " ").slice(0, 19) : "never"}
        </div>
      </div>
    </aside>
  );
}

export function MobileTabs() {
  const pathname = usePathname() || "";
  return (
    <nav className="md:hidden flex border-b border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] sticky top-0 z-20 overflow-x-auto">
      {MOBILE_NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 min-w-[80px] text-center py-3 text-[13px] transition ${
              active
                ? "text-[color:var(--color-fg)] border-b-2 border-[color:var(--color-accent)]"
                : "text-[color:var(--color-fg-faint)]"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
