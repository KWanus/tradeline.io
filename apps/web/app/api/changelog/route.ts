import { NextResponse } from "next/server";
import { CHANGELOG } from "@/lib/changelog-entries";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Public read-only JSON of the changelog. Same source as /changelog (HTML)
 * and /changelog.xml (RSS), but structured for integrators — agents, dev
 * dashboards, internal tooling.
 *
 * Static render with hourly revalidate. Open CORS.
 */
export function GET() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  const entries = CHANGELOG.map((entry, index) => {
    const anchor = `${entry.date}-${index}`;
    return {
      anchor,
      date: entry.date,
      title: entry.title,
      summary: entry.summary || null,
      bullets: entry.bullets,
      tags: entry.tags || [],
      links: {
        page: `${siteUrl}/changelog#${anchor}`,
      },
    };
  });

  return NextResponse.json(
    {
      ok: true,
      count: entries.length,
      latest: CHANGELOG[0]?.date || null,
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
