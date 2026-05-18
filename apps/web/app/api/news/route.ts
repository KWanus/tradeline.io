import { NextResponse } from "next/server";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public JSON of matched news headlines across every tracked bank.
 *
 * Same data the /news HTML page renders, exposed for integrators —
 * the MCP server, analyst scripts, anything that wants the headline
 * stream without parsing HTML.
 *
 * Query params:
 *   ?ticker=COF        filter to headlines mentioning that ticker
 *   ?limit=N           cap result count (default 50, max 500)
 *
 * Open CORS, 5-minute cache, OPTIONS preflight matching the rest of
 * the API surface.
 */
export async function GET(req: Request) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch (err) {
    return json(
      { ok: false, error: "snapshot unavailable", detail: (err as Error).message },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const tickerFilter = (url.searchParams.get("ticker") || "").trim().toUpperCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 500)
      : 50;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  const all = snap.matched_news || [];

  // Per-ticker headline counts over the full snapshot (not the filtered slice)
  const tickerCounts: Record<string, number> = {};
  for (const n of all) {
    for (const t of n.matched_tickers || []) {
      tickerCounts[t] = (tickerCounts[t] || 0) + 1;
    }
  }

  let items = all
    .map((n) => ({
      sourceId: n.source_id,
      title: n.title,
      link: n.link,
      publisher: n.publisher,
      publishedAt: n.published_at,
      matchedTickers: n.matched_tickers || [],
    }))
    .sort((a, b) => {
      const ta = new Date(a.publishedAt).getTime();
      const tb = new Date(b.publishedAt).getTime();
      return (tb || 0) - (ta || 0);
    });

  if (tickerFilter) {
    items = items.filter((n) => n.matchedTickers.includes(tickerFilter));
  }
  const total = items.length;
  items = items.slice(0, limit);

  return json({
    ok: true,
    count: items.length,
    total,
    filters: { ticker: tickerFilter || null, limit },
    tickers: tickerCounts,
    items,
    links: {
      page: tickerFilter
        ? `${siteUrl}/news?ticker=${tickerFilter}`
        : `${siteUrl}/news`,
    },
    snapshot: { generatedAt: snap.generated_at || null },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(
  body: Record<string, unknown>,
  init: { status?: number } = {}
): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...corsHeaders(),
    },
  });
}
