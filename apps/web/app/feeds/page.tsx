import Link from "next/link";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata = {
  title: "Feeds & APIs · Tradeline",
  description:
    "Every machine-readable surface Tradeline exposes — RSS feeds for the weekly report and changelog, JSON APIs for radar state, plus the security.txt and health endpoints.",
};

export default function FeedsPage() {
  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
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
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <a
          href="https://github.com/KWanus/tradeline.io"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Source &nearr;
        </a>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Feeds &amp; APIs
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Tradeline is{" "}
          <span className="italic text-gradient-accent">API-first.</span>
        </h1>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          Every public surface has a machine-readable form. RSS for the weekly
          report and the changelog, JSON for the radar, plain text for the
          well-known endpoints. CORS is open; cache TTLs are short.
        </p>

        <Section title="RSS feeds">
          <Endpoint
            url="/feed.xml"
            title="Tradeline weekly · Charge-Off Report"
            description="Current week's digest as a single RSS 2.0 item. GUID is week-anchored so readers see one entry per week. Full email-safe HTML in content:encoded."
            mime="application/rss+xml"
          />
          <Endpoint
            url="/changelog.xml"
            title="Tradeline · changelog"
            description="One item per CHANGELOG entry, newest first. Stable GUIDs (date + index). Tags as <category>."
            mime="application/rss+xml"
          />
        </Section>

        <Section title="JSON APIs">
          <Endpoint
            url="/api/banks"
            title="All tracked banks (index)"
            description="Every originator on the radar with status + confidence + counts + links. Query params: ?status=strong|watching|quiet, ?tier=…, ?limit=N. 5-min cache, open CORS."
            mime="application/json"
          />
          <Endpoint
            url="/api/banks/COF"
            title="Per-bank radar state"
            description="One bank's full state: top 12 signals (with YoY%, excerpt, EDGAR link), top 10 matched news, links back to /banks page + OG image. Replace COF with any tracked ticker."
            mime="application/json"
          />
          <Endpoint
            url="/api/health"
            title="Site & infrastructure health"
            description="Status (ok | degraded | stale) + snapshot age + service env-var checks. Designed for uptime monitors — alert on body.status, not HTTP code."
            mime="application/json"
          />
        </Section>

        <Section title="Sitemaps & well-known">
          <Endpoint
            url="/sitemap.xml"
            title="Sitemap"
            description="All public surfaces + every per-bank page (66 URLs total). lastModified pulled from each bank's last filing date."
            mime="application/xml"
          />
          <Endpoint
            url="/robots.txt"
            title="Robots policy"
            description="Allow list for the public site. Disallow /app/, /api/, and tokenized unsubscribe URLs. Sitemap reference at the bottom."
            mime="text/plain"
          />
          <Endpoint
            url="/.well-known/security.txt"
            title="security.txt"
            description="RFC 9116. Two contact addresses, 1-year expiry stamp, inline disclosure policy."
            mime="text/plain"
          />
        </Section>

        <section className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Try it
          </div>
          <pre className="mt-3 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded p-3 font-mono text-[12px] text-[color:var(--color-fg-dim)] overflow-x-auto leading-relaxed">{`# every strong bank, sorted by confidence
curl 'https://tradeline.io/api/banks?status=strong' | jq '.banks[] | .ticker'

# one bank's full state
curl 'https://tradeline.io/api/banks/COF' | jq '.signals[0]'

# liveness for an uptime monitor
curl -s 'https://tradeline.io/api/health' | jq -r '.status'`}</pre>
          <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
            No auth, no rate limit advertised — please be reasonable. If you
            need higher throughput or a more stable contract,{" "}
            <Link
              href="/apply"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              apply for design partner
            </Link>{" "}
            and we&rsquo;ll talk.
          </p>
        </section>

        <section className="mt-10 rounded-xl border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]">
            MCP server
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            Tradeline ships an MCP server at{" "}
            <code className="font-mono text-[13px] text-[color:var(--color-fg)]">mcp-servers/deal-radar</code>{" "}
            (in the repo). Wire it into Claude Desktop or any MCP-aware
            assistant and these endpoints become tool calls your agent can
            invoke mid-conversation. See{" "}
            <Link
              href="/app/playbook"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              the playbook
            </Link>{" "}
            for the connection config.
          </p>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif italic text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)] mb-4">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Endpoint({
  url,
  title,
  description,
  mime,
}: {
  url: string;
  title: string;
  description: string;
  mime: string;
}) {
  return (
    <article className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="font-mono text-[13px] text-[color:var(--color-accent)]">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {url}
          </a>
        </div>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {mime}
        </span>
      </div>
      <div className="mt-2 text-[14px] text-[color:var(--color-fg)]">
        {title}
      </div>
      <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {description}
      </p>
    </article>
  );
}
