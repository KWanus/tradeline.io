import { readSnapshot } from "@/lib/snapshot";
import { buildWeeklyDigest } from "@/lib/report-digest";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(d: Date): string {
  return d.toUTCString();
}

/**
 * RSS 2.0 feed for the Tradeline weekly Charge-Off Report. Renders the
 * current week's digest as a single item — the snapshot updates every 6h
 * and the email cron fires every Monday, so RSS readers polling daily get
 * a fresh item each week.
 */
export async function GET() {
  const site = siteUrl();
  const snap = await readSnapshot().catch(() => null);

  const digest = snap ? buildWeeklyDigest(snap, { siteUrl: site }) : null;
  const generated = snap?.generated_at
    ? new Date(snap.generated_at)
    : new Date();

  // Use the start of the current ISO week as the item GUID so readers
  // see one item per week, not per render.
  const weekStart = new Date(generated);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  weekStart.setUTCHours(13, 0, 0, 0);
  const weekId = weekStart.toISOString().slice(0, 10);

  const title = digest
    ? digest.subject
    : "Tradeline weekly — Charge-Off Report (radar warming up)";
  const description = digest
    ? digest.preheader
    : "The radar is initializing. Subscribe at /report to get the digest by email and stay updated.";
  const reportUrl = `${site}/report`;
  const aboutUrl = `${site}/about`;

  const itemHtml = digest
    ? digest.html
    : `<p>Tradeline weekly hasn't built its first issue yet. <a href="${reportUrl}">Subscribe at /report</a> or <a href="${aboutUrl}">read /about</a>.</p>`;

  const lastBuild = rfc822(new Date());
  const itemPubDate = rfc822(weekStart);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Tradeline weekly · Charge-Off Report</title>
    <link>${escape(reportUrl)}</link>
    <atom:link href="${escape(`${site}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>Every Monday: which US banks are showing distress in their public filings. Free. Public-source data only.</description>
    <language>en-us</language>
    <ttl>1440</ttl>
    <generator>Tradeline</generator>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <item>
      <guid isPermaLink="false">tradeline-weekly-${weekId}</guid>
      <title>${escape(title)}</title>
      <link>${escape(reportUrl)}</link>
      <description>${escape(description)}</description>
      <content:encoded><![CDATA[${itemHtml}]]></content:encoded>
      <pubDate>${itemPubDate}</pubDate>
    </item>
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
