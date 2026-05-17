import { CHANGELOG } from "@/lib/changelog-entries";

export const dynamic = "force-static";
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

function rfc822(iso: string): string {
  return new Date(`${iso}T13:00:00Z`).toUTCString();
}

function bulletsToHtml(bullets: string[]): string {
  return `<ul>${bullets.map((b) => `<li>${escape(b)}</li>`).join("")}</ul>`;
}

/**
 * RSS 2.0 feed of the public changelog. One item per CHANGELOG entry,
 * ordered newest first. Updates whenever lib/changelog-entries.ts changes.
 */
export async function GET() {
  const site = siteUrl();
  const changelogUrl = `${site}/changelog`;
  const lastBuild = rfc822(new Date().toISOString().slice(0, 10));

  const items = CHANGELOG.map((entry, idx) => {
    const summary = entry.summary || "";
    const desc = escape(summary);
    const content = `${summary ? `<p>${escape(summary)}</p>` : ""}${bulletsToHtml(entry.bullets)}`;
    return `    <item>
      <guid isPermaLink="false">tradeline-changelog-${entry.date}-${idx}</guid>
      <title>${escape(entry.title)}</title>
      <link>${escape(changelogUrl)}#${entry.date}-${idx}</link>
      <description>${desc}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${rfc822(entry.date)}</pubDate>${
        entry.tags && entry.tags.length
          ? `
${entry.tags.map((t) => `      <category>${escape(t)}</category>`).join("\n")}`
          : ""
      }
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Tradeline · Changelog</title>
    <link>${escape(changelogUrl)}</link>
    <atom:link href="${escape(`${site}/changelog.xml`)}" rel="self" type="application/rss+xml" />
    <description>What's shipped on Tradeline. Newest first.</description>
    <language>en-us</language>
    <ttl>1440</ttl>
    <generator>Tradeline</generator>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
