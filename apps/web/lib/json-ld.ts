/**
 * Schema.org JSON-LD builders. Each function returns a serializable object
 * that gets injected into a <script type="application/ld+json"> tag.
 *
 * Why JSON-LD here:
 * - Organization shows up in Google's knowledge panel + makes the logo
 *   appear next to the brand name in search results.
 * - WebSite enables the SearchAction sitelink searchbox (Google may render
 *   a search field directly under the result, scoped to the site).
 * - FAQPage gets expandable Q&A right in the SERP for /about.
 * - Article / NewsArticle make /report and /changelog eligible for
 *   "Top stories" + Article rich results.
 */

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
).replace(/\/$/, "");

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tradeline",
    legalName: "Tradeline",
    url: SITE,
    logo: `${SITE}/icon.svg`,
    description:
      "Tradeline is a research and operations workbase for the non-performing-loan ecosystem — debt buyers, brokers, hypothecation lenders, and consumer-finance attorneys.",
    sameAs: ["https://github.com/KWanus/tradeline.io"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@tradeline.io",
      },
    ],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Tradeline",
    url: SITE,
    description:
      "Institutional intelligence for licensed debt buyers, brokers, and lenders. 57-bank live SEC radar, AI tutor, tape copilot.",
    publisher: {
      "@type": "Organization",
      name: "Tradeline",
      url: SITE,
    },
  };
}

export function reportLd(opts: {
  bankCount: number;
  signalCount: number;
  filingCount: number;
  snapshotGeneratedAt?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: `The ${opts.bankCount}-Bank Charge-Off Report · Tradeline weekly`,
    description:
      "Every Monday: which US banks are showing distress in their public filings, scored. Free. No paywall. No consumer data.",
    image: `${SITE}/report/opengraph-image`,
    datePublished: opts.snapshotGeneratedAt || new Date().toISOString(),
    dateModified: opts.snapshotGeneratedAt || new Date().toISOString(),
    author: { "@type": "Organization", name: "Tradeline", url: SITE },
    publisher: {
      "@type": "Organization",
      name: "Tradeline",
      url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/report` },
    keywords: [
      "non-performing loans",
      "charge-off",
      "debt buying",
      "SEC EDGAR",
      "bank credit quality",
      `${opts.signalCount} signals`,
      `${opts.filingCount} filings indexed`,
    ].join(", "),
  };
}

export function aboutFaqLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What data does Tradeline collect?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tradeline ingests public-source data only: SEC EDGAR filings, XBRL standard accounting concepts (charge-off, allowance, NPL ratio), Google News matched to a tracked bank's CIK, and CourtListener federal-court dockets. The only personal data we collect is what you type into the subscribe form at /report (email, optional name, optional reader type).",
        },
      },
      {
        "@type": "Question",
        name: "Does Tradeline see consumer or debtor data?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The tape copilot parses CSVs in your browser; row-level data (names, addresses, phones, SSNs, account numbers) never reaches our servers. PII column headers are auto-detected and skipped. Tradeline is architected to stay outside FCRA scope.",
        },
      },
      {
        "@type": "Question",
        name: "How does the radar score banks?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Four inputs weighted by recency and confidence: SEC XBRL charge-off cohort velocity (QoQ + YoY deltas), 8-K items 2.01/2.06/7.01 keyword matches, news-feed matches to the bank's CIK, and court docket signals. Each yields a 0.0–1.0 score per bank per week: Strong ≥0.7, Watching 0.5–0.7, Quiet <0.5.",
        },
      },
      {
        "@type": "Question",
        name: "How much does Tradeline cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The weekly Charge-Off Report is free — no paywall, no credit card. The workbase is currently free for design partners — operators willing to give product feedback in exchange for early access and a permanent 50% discount. Supply-side intelligence (alerts for brokers, lenders, attorneys, CPAs) is sold separately.",
        },
      },
      {
        "@type": "Question",
        name: "Who built Tradeline?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A solo founder in the Mid-Atlantic, bootstrapping without outside capital. The codebase is public on GitHub. The radar workers are Python; the workbase is Next.js. Radar data is committed to a data branch by a GitHub Actions cron that runs every 6 hours.",
        },
      },
    ],
  };
}

export function changelogLd(opts: {
  count: number;
  latest?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Tradeline · Changelog",
    description: "What's shipped on Tradeline — newest first.",
    url: `${SITE}/changelog`,
    publisher: { "@type": "Organization", name: "Tradeline", url: SITE },
    isPartOf: { "@type": "WebSite", name: "Tradeline", url: SITE },
    numberOfItems: opts.count,
    dateModified: opts.latest
      ? new Date(`${opts.latest}T13:00:00Z`).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Renders a JSON-LD object as a <script type="application/ld+json"> tag.
 * Use dangerouslySetInnerHTML so React doesn't escape the JSON. The
 * payload is built from trusted sources only — no user input — so XSS
 * isn't a concern.
 */
export function jsonLdScript(payload: Record<string, unknown>) {
  return {
    __html: JSON.stringify(payload),
  };
}
