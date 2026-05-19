import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Spreadsheet-friendly export of every scored SEC signal across the
 * tracked banks. Same data as /api/signals, shaped for direct download.
 *
 * Query params:
 *   ?ticker=COF      filter to one bank
 *   ?form=10-Q       filter to one SEC form type
 *   ?limit=N         cap row count (default 200, max 1000)
 */
export async function GET(req: Request) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const url = new URL(req.url);
  const tickerFilter = (url.searchParams.get("ticker") || "").trim().toUpperCase();
  const formFilter = (url.searchParams.get("form") || "").trim().toUpperCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 1000)
      : 200;

  let items = (snap.top_signals || []).slice().sort((a, b) => {
    const ta = new Date(a.filed_at).getTime();
    const tb = new Date(b.filed_at).getTime();
    if ((tb || 0) !== (ta || 0)) return (tb || 0) - (ta || 0);
    return b.confidence - a.confidence;
  });
  if (tickerFilter) items = items.filter((s) => s.ticker === tickerFilter);
  if (formFilter)
    items = items.filter((s) => (s.form_type || "").toUpperCase() === formFilter);
  items = items.slice(0, limit);

  const header = [
    "filed_at",
    "ticker",
    "form_type",
    "signal_type",
    "confidence",
    "yoy_pct",
    "concept",
    "period_label",
    "url",
    "source",
    "source_id",
  ].join(",");

  const rows = items.map((s) =>
    [
      csv(s.filed_at || ""),
      csv(s.ticker || ""),
      csv(s.form_type || ""),
      csv(s.signal_type || ""),
      csv(s.confidence.toFixed(4)),
      csv(typeof s.yoy_pct === "number" ? s.yoy_pct.toFixed(2) : ""),
      csv(s.concept || ""),
      csv(s.period_label || ""),
      csv(s.url || ""),
      csv(s.source || ""),
      csv(s.source_id || ""),
    ].join(",")
  );

  const filenameSuffix = [tickerFilter, formFilter]
    .filter(Boolean)
    .join("-")
    .toLowerCase();

  const meta = [
    `"# tradeline.io · signals export · generated ${new Date().toISOString()}"`,
    `"# snapshot ${snap.generated_at || "(unknown)"} · ticker=${tickerFilter || "all"} · form=${formFilter || "all"} · ${items.length} rows"`,
  ].join("\n");

  const body = `${meta}\n${header}\n${rows.join("\n")}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tradeline-signals${filenameSuffix ? `-${filenameSuffix}` : ""}.csv"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function csv(value: string): string {
  const cleaned = String(value).replace(/\r?\n/g, " ");
  return `"${cleaned.replace(/"/g, '""')}"`;
}
