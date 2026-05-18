import Link from "next/link";

type Group = {
  label: string;
  links: Array<{
    href: string;
    label: string;
    external?: boolean;
    arrow?: string;
  }>;
};

const GROUPS: Group[] = [
  {
    label: "Product",
    links: [
      { href: "/report", label: "Weekly report" },
      { href: "/coverage", label: "Coverage · 57 banks" },
      { href: "/news", label: "Headlines" },
      { href: "/signals", label: "SEC signals" },
      { href: "/apply", label: "Apply · design partner" },
      { href: "/app/today", label: "Open workbase" },
    ],
  },
  {
    label: "Learn",
    links: [
      { href: "/about", label: "About" },
      { href: "/app/learn", label: "How this works" },
      { href: "/changelog", label: "Changelog" },
      { href: "/kit", label: "Share kit" },
    ],
  },
  {
    label: "Developers",
    links: [
      { href: "/feeds", label: "Feeds & APIs" },
      { href: "/api/openapi.json", label: "OpenAPI spec", external: true, arrow: "↗" },
      { href: "/status", label: "Status" },
      {
        href: "https://github.com/KWanus/tradeline.io",
        label: "GitHub",
        external: true,
        arrow: "↗",
      },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/unsubscribe", label: "Unsubscribe" },
      {
        href: "/.well-known/security.txt",
        label: "Security",
        external: true,
        arrow: "↗",
      },
    ],
  },
];

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-[color:var(--color-line)] mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Brand + tagline */}
        <div className="flex items-start justify-between gap-8 flex-wrap mb-8 pb-6 border-b border-[color:var(--color-line)]">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-90 transition"
          >
            <span
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
              style={{ background: "var(--gradient-primary)" }}
            >
              T
            </span>
            <span className="font-serif italic text-[18px] text-[color:var(--color-fg)]">
              Tradeline
            </span>
          </Link>
          <p className="font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)] max-w-md leading-relaxed">
            Public-source non-performing-loan radar. Zero consumer information.
            Built for licensed debt buyers, brokers, hypothecation lenders, and
            consumer-finance attorneys.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
                {g.label}
              </div>
              <ul className="space-y-2">
                {g.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
                      >
                        {l.label}{" "}
                        {l.arrow && (
                          <span className="text-[color:var(--color-fg-faint)]">
                            {l.arrow}
                          </span>
                        )}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
                      >
                        {l.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-6 border-t border-[color:var(--color-line)] font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          <div>
            &copy; {year} TRADELINE &middot; Public-source data only &middot;
            Zero consumer information
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/feed.xml"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[color:var(--color-accent)] transition"
            >
              RSS &nearr;
            </a>
            <Link
              href="/feeds"
              className="hover:text-[color:var(--color-accent)] transition"
            >
              All feeds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
