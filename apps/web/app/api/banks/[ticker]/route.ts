import "server-only";

import { NextResponse } from "next/server";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public read-only JSON of a single bank's radar state. Same data the
 * /banks/[ticker] HTML page renders — exposed here so external consumers
 * (the MCP server, downstream apps, analyst scripts) can fetch without
 * parsing HTML.
 *
 * CORS: open. The data is already public on the site; sharing it via JSON
 * doesn't expose anything additional and removes a friction step for
 * legitimate integrations.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch (err) {
    return json(
      { ok: false, error: "snapshot unavailable", detail: (err as Error).message },
      { status: 503 }
    );
  }

  const originator = snap.originators.find((o) => o.ticker === ticker);
  if (!originator) {
    return json(
      { ok: false, error: "ticker not tracked", ticker },
      { status: 404 }
    );
  }

  const signals = snap.top_signals
    .filter((s) => s.ticker === ticker)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12)
    .map((s) => ({
      source: s.source,
      sourceId: s.source_id,
      signalType: s.signal_type,
      formType: s.form_type,
      filedAt: s.filed_at,
      confidence: s.confidence,
      url: s.url,
      excerpt: s.excerpt || null,
      // XBRL-only fields, surfaced as flat properties when present
      concept: s.concept || null,
      periodLabel: s.period_label || null,
      yoyPct: s.yoy_pct ?? null,
    }));

  const news = snap.matched_news
    .filter((n) => (n.matched_tickers || []).includes(ticker))
    .slice(0, 10)
    .map((n) => ({
      sourceId: n.source_id,
      title: n.title,
      link: n.link,
      publisher: n.publisher,
      publishedAt: n.published_at,
    }));

  const status = statusFor(originator);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  return json({
    ok: true,
    ticker,
    name: originator.name,
    tier: originator.tier,
    status,
    confidence: originator.max_confidence,
    counts: {
      filings: originator.filings,
      signals: originator.signals,
      news: originator.news_mentions,
    },
    lastFiledAt: originator.last_filed_at,
    autoDiscovered: Boolean(originator.auto_discovered),
    signals,
    news,
    links: {
      page: `${siteUrl}/banks/${ticker}`,
      ogImage: `${siteUrl}/banks/${ticker}/opengraph-image`,
    },
    snapshot: {
      generatedAt: snap.generated_at || null,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
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
