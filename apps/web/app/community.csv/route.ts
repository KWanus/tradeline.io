import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Spreadsheet-friendly export of community-bank credit signals from the
 * FDIC Call Report worker. Same data as /api/community.
 *
 * Query params:
 *   ?state=MD        filter to one state
 *   ?type=charge_off_increase | npl_ratio_increase
 *   ?limit=N         cap row count (default 300, max 2000)
 */
export async function GET(req: Request) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const url = new URL(req.url);
  const stateFilter = (url.searchParams.get("state") || "").trim().toUpperCase();
  const typeFilter = (url.searchParams.get("type") || "").trim();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 2000)
      : 300;

  let items = (snap.fdic_signals || [])
    .slice()
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.yoy_pct || 0) - (a.yoy_pct || 0);
    });
  if (stateFilter) items = items.filter((s) => s.state === stateFilter);
  if (typeFilter) items = items.filter((s) => s.signal_type === typeFilter);
  items = items.slice(0, limit);

  const header = [
    "cert",
    "name",
    "state",
    "tier",
    "signal_type",
    "confidence",
    "period_label",
    "concept",
    "value_thousands",
    "prior_year_value_thousands",
    "yoy_pct",
    "asset_total_thousands",
    "fdic_url",
  ].join(",");

  const rows = items.map((s) =>
    [
      csv(s.cert || ""),
      csv(s.originator_name || ""),
      csv(s.state || ""),
      csv(s.tier || ""),
      csv(s.signal_type || ""),
      csv(s.confidence.toFixed(4)),
      csv(s.period_label || ""),
      csv(s.concept || ""),
      csv(String(s.value)),
      csv(String(s.prior_year_value)),
      csv(typeof s.yoy_pct === "number" ? s.yoy_pct.toFixed(2) : ""),
      csv(String(s.asset_total)),
      csv(s.url || ""),
    ].join(",")
  );

  const filenameSuffix = [stateFilter, typeFilter]
    .filter(Boolean)
    .join("-")
    .toLowerCase();

  const meta = [
    `"# tradeline.io · community-bank signals export · generated ${new Date().toISOString()}"`,
    `"# snapshot ${snap.generated_at || "(unknown)"} · state=${stateFilter || "all"} · type=${typeFilter || "all"} · ${items.length} rows"`,
    `"# dollar figures are in thousands, as reported in FDIC Call Reports"`,
  ].join("\n");

  const body = `${meta}\n${header}\n${rows.join("\n")}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tradeline-community${filenameSuffix ? `-${filenameSuffix}` : ""}.csv"`,
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
