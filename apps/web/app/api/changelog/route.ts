import { NextResponse } from "next/server";
import { CHANGELOG } from "@/lib/changelog-entries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public read-only JSON of the changelog. Same source as /changelog (HTML)
 * and /changelog.xml (RSS), but structured for integrators — agents, dev
 * dashboards, internal tooling.
 *
 * Optional ?tag=<tag> filters to entries that include that tag. Anchor
 * strings still encode the absolute index into CHANGELOG so consumers can
 * link back to the right HTML position even when filtered.
 *
 * Static render with hourly revalidate. Open CORS.
 */
export function GET(req: Request) {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  const url = new URL(req.url);
  const tagFilter = (url.searchParams.get("tag") || "").trim().toLowerCase();

  const all = CHANGELOG.map((entry, index) => {
    const anchor = `${entry.date}-${index}`;
    return {
      anchor,
      date: entry.date,
      title: entry.title,
      summary: entry.summary || null,
      bullets: entry.bullets,
      tags: entry.tags || [],
      links: {
        page: tagFilter
          ? `${siteUrl}/changelog?tag=${encodeURIComponent(tagFilter)}#${anchor}`
          : `${siteUrl}/changelog#${anchor}`,
      },
    };
  });

  const entries = tagFilter
    ? all.filter((e) => e.tags.includes(tagFilter))
    : all;

  // Tag index — counts across the full changelog, not the filtered slice.
  const tagCounts: Record<string, number> = {};
  for (const e of all) {
    for (const t of e.tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      count: entries.length,
      totalReleases: all.length,
      latest: CHANGELOG[0]?.date || null,
      filters: { tag: tagFilter || null },
      tags: tagCounts,
      entries,
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
