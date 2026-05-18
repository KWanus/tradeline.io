import "server-only";

import { NextResponse } from "next/server";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Index endpoint — every tracked bank in one JSON document.
 *
 * Query params:
 *   ?status=strong|watching|quiet     filter by current status
 *   ?tier=t1|t2|specialty|...         exact-match tier filter
 *   ?limit=N                          cap result count (default: no cap)
 *
 * Same CORS posture as /api/banks/[ticker] — fully open. The list is
 * already public via /coverage; serving it as JSON adds no new
 * exposure and removes friction for the MCP server + downstream
 * integrators.
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
  const statusFilter = (url.searchParams.get("status") || "").toLowerCase();
  const tierFilter = (url.searchParams.get("tier") || "").toLowerCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 500)
      : null;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  let banks = snap.originators
    .map((o) => ({
      ticker: o.ticker,
      name: o.name,
      tier: o.tier,
      status: statusFor(o),
      confidence: o.max_confidence,
      counts: {
        filings: o.filings,
        signals: o.signals,
        news: o.news_mentions,
      },
      lastFiledAt: o.last_filed_at,
      autoDiscovered: Boolean(o.auto_discovered),
      links: {
        page: `${siteUrl}/banks/${o.ticker}`,
        api: `${siteUrl}/api/banks/${o.ticker}`,
      },
    }))
    .sort((a, b) => {
      // Strong → watching → quiet, then by confidence desc
      const rank: Record<string, number> = {
        strong: 0,
        watching: 1,
        quiet: 2,
      };
      const ra = rank[a.status] ?? 3;
      const rb = rank[b.status] ?? 3;
      if (ra !== rb) return ra - rb;
      return b.confidence - a.confidence;
    });

  if (statusFilter) {
    banks = banks.filter((b) => b.status === statusFilter);
  }
  if (tierFilter) {
    banks = banks.filter((b) => (b.tier || "").toLowerCase() === tierFilter);
  }
  if (limit !== null) {
    banks = banks.slice(0, limit);
  }

  return json({
    ok: true,
    count: banks.length,
    totalTracked: snap.originators.length,
    filters: {
      status: statusFilter || null,
      tier: tierFilter || null,
      limit,
    },
    banks,
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
