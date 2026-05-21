import { NextResponse } from "next/server";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public JSON of community-bank credit signals from the FDIC Call Report
 * worker. Same data the /community HTML page renders.
 *
 * Query params:
 *   ?state=MD          filter to one state (case-insensitive)
 *   ?type=charge_off_increase | npl_ratio_increase
 *   ?limit=N           cap result count (default 100, max 500)
 *
 * Open CORS, 5-minute cache, OPTIONS preflight.
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
  const stateFilter = (url.searchParams.get("state") || "").trim().toUpperCase();
  const typeFilter = (url.searchParams.get("type") || "").trim();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 500)
      : 100;

  const all = snap.fdic_signals || [];

  // Counts over the full set, not the filtered slice.
  const stateCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const s of all) {
    if (s.state) stateCounts[s.state] = (stateCounts[s.state] || 0) + 1;
    if (s.signal_type)
      typeCounts[s.signal_type] = (typeCounts[s.signal_type] || 0) + 1;
  }

  let items = all
    .slice()
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.yoy_pct || 0) - (a.yoy_pct || 0);
    });
  if (stateFilter) items = items.filter((s) => s.state === stateFilter);
  if (typeFilter) items = items.filter((s) => s.signal_type === typeFilter);

  const total = items.length;
  items = items.slice(0, limit);

  const mapped = items.map((s) => ({
    cert: s.cert,
    ticker: s.ticker,
    name: s.originator_name,
    state: s.state,
    tier: s.tier,
    signalType: s.signal_type,
    confidence: s.confidence,
    filedAt: s.filed_at,
    periodLabel: s.period_label,
    concept: s.concept,
    value: s.value,
    priorYearValue: s.prior_year_value,
    yoyPct: s.yoy_pct,
    assetTotal: s.asset_total,
    url: s.url,
  }));

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");
  const pageQs = new URLSearchParams();
  if (stateFilter) pageQs.set("state", stateFilter);
  if (typeFilter) pageQs.set("type", typeFilter);
  const pageQuery = pageQs.toString();

  return json({
    ok: true,
    count: mapped.length,
    total,
    filters: { state: stateFilter || null, type: typeFilter || null, limit },
    states: stateCounts,
    types: typeCounts,
    items: mapped,
    links: {
      page: pageQuery
        ? `${siteUrl}/community?${pageQuery}`
        : `${siteUrl}/community`,
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
