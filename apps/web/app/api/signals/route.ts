import { NextResponse } from "next/server";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public JSON of scored SEC signals across every tracked bank. Same data
 * the /signals HTML page renders, exposed for integrators.
 *
 * Query params:
 *   ?ticker=COF          filter to one bank (case-insensitive)
 *   ?form=10-K           filter to one form type (case-insensitive)
 *   ?limit=N             cap result count (default 50, max 500)
 *
 * Open CORS, 5-minute cache.
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
  const formFilter = (url.searchParams.get("form") || "").trim().toUpperCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 500)
      : 50;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  const all = snap.top_signals || [];

  // Counts across the full snapshot — not the filtered slice.
  const tickerCounts: Record<string, number> = {};
  const formCounts: Record<string, number> = {};
  for (const s of all) {
    if (s.ticker) tickerCounts[s.ticker] = (tickerCounts[s.ticker] || 0) + 1;
    if (s.form_type)
      formCounts[s.form_type] = (formCounts[s.form_type] || 0) + 1;
  }

  let items = all
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.filed_at).getTime();
      const tb = new Date(b.filed_at).getTime();
      if ((tb || 0) !== (ta || 0)) return (tb || 0) - (ta || 0);
      return b.confidence - a.confidence;
    });

  if (tickerFilter) items = items.filter((s) => s.ticker === tickerFilter);
  if (formFilter) items = items.filter((s) => (s.form_type || "").toUpperCase() === formFilter);

  const total = items.length;
  items = items.slice(0, limit);

  const mapped = items.map((s) => ({
    sourceId: s.source_id,
    source: s.source,
    ticker: s.ticker,
    signalType: s.signal_type,
    formType: s.form_type,
    filedAt: s.filed_at,
    confidence: s.confidence,
    url: s.url,
    excerpt: s.excerpt || null,
    concept: s.concept || null,
    periodLabel: s.period_label || null,
    yoyPct: s.yoy_pct ?? null,
    links: {
      bank: `${siteUrl}/banks/${s.ticker}`,
    },
  }));

  // Build the canonical page link, preserving active filters.
  const pageQs = new URLSearchParams();
  if (tickerFilter) pageQs.set("ticker", tickerFilter);
  if (formFilter) pageQs.set("form", formFilter);
  const pageQuery = pageQs.toString();

  return json({
    ok: true,
    count: mapped.length,
    total,
    filters: {
      ticker: tickerFilter || null,
      form: formFilter || null,
      limit,
    },
    tickers: tickerCounts,
    forms: formCounts,
    items: mapped,
    links: {
      page: pageQuery
        ? `${siteUrl}/signals?${pageQuery}`
        : `${siteUrl}/signals`,
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
