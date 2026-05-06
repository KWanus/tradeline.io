"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; soon?: boolean };

type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "START HERE",
    items: [{ href: "/app/learn", label: "How this works" }],
  },
  {
    label: "MARKET INTELLIGENCE",
    items: [
      { href: "/app/today", label: "Today" },
      { href: "/app/banks", label: "Banks" },
      { href: "/app/news", label: "News" },
    ],
  },
  {
    label: "ECOSYSTEM",
    items: [
      { href: "/app/brokers", label: "Brokers" },
      { href: "/app/lenders", label: "Lenders" },
      { href: "/app/servicers", label: "Servicers", soon: true },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/app/pipeline", label: "Pipeline" },
      { href: "/app/portfolio", label: "Portfolio" },
      { href: "/app/capital", label: "Capital" },
      { href: "/app/compliance", label: "Compliance" },
    ],
  },
  {
    label: "BUSINESS",
    items: [{ href: "/app/customers", label: "Customers", soon: true }],
  },
  {
    label: "TOOLS",
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

export function Sidebar({ generatedAt }: { generatedAt: string }) {
  const pathname = usePathname() || "";

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]">
      <Link
        href="/"
        className="flex items-center gap-3 px-5 py-5 border-b border-[color:var(--color-line)] hover:opacity-90 transition"
      >
        <span className="h-2 w-2 rounded-full bg-[color:var(--color-accent)] glow" />
        <span className="font-mono text-sm tracking-[0.18em] text-[color:var(--color-fg)]">
          TRADELINE
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? "mt-5" : ""}>
            <div className="px-2 pb-2 font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
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
                      className={`flex items-center justify-between px-3 py-2 text-[14px] rounded-sm transition ${
                        active
                          ? "bg-[color:var(--color-bg-2)] text-[color:var(--color-fg)]"
                          : "text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-2)] hover:text-[color:var(--color-fg)]"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.soon && (
                        <span className="font-mono text-[9px] tracking-[0.2em] text-[color:var(--color-fg-faint)] uppercase">
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

        <div className="mt-7 px-2">
          <Link
            href="/app/roadmap"
            className={`flex items-center justify-between px-3 py-2 text-[14px] rounded-sm border transition ${
              pathname.startsWith("/app/roadmap")
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            <span>Vision &amp; roadmap</span>
            <span className="text-[color:var(--color-fg-faint)]">&rarr;</span>
          </Link>
        </div>
      </nav>

      <div className="px-5 py-4 border-t border-[color:var(--color-line)] font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
        <div className="text-[color:var(--color-fg-faint)] mb-1">DATA REFRESHED</div>
        <div className="text-[color:var(--color-fg-dim)]">
          {generatedAt ? generatedAt.replace("T", " ").slice(0, 19) : "never"}
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
            className={`flex-1 min-w-[80px] text-center py-3 font-mono text-[12px] tracking-[0.18em] uppercase transition ${
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
