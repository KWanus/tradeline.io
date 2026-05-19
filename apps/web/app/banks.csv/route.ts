import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Spreadsheet-friendly export of every tracked bank. Same data as
 * /api/banks but shaped for direct download into Excel / Google Sheets /
 * Airtable / a one-off Pandas DataFrame.
 *
 * Query params:
 *   ?status=strong|watching|quiet     filter to one status
 *   ?tier=regional|specialty|...      exact-match tier filter
 *
 * Open CORS, 5-min cache.
 */
export async function GET(req: Request) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {
    // Still emit valid empty CSV so consumers don't error on parse.
  }

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") || "").toLowerCase();
  const tierFilter = (url.searchParams.get("tier") || "").toLowerCase();

  let banks = snap.originators.map((o) => ({
    ticker: o.ticker,
    name: o.name || "",
    tier: o.tier || "",
    status: statusFor(o),
    confidence: o.max_confidence.toFixed(4),
    filings: o.filings,
    signals: o.signals,
    news: o.news_mentions,
    last_filed_at: o.last_filed_at || "",
    auto_discovered: Boolean(o.auto_discovered),
  }));

  if (statusFilter) banks = banks.filter((b) => b.status === statusFilter);
  if (tierFilter) banks = banks.filter((b) => b.tier.toLowerCase() === tierFilter);

  // Sort: strong → watching → quiet, then confidence desc within each group.
  const rank: Record<string, number> = { strong: 0, watching: 1, quiet: 2 };
  banks.sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return parseFloat(b.confidence) - parseFloat(a.confidence);
  });

  const header = [
    "ticker",
    "name",
    "tier",
    "status",
    "confidence",
    "filings",
    "signals",
    "news_mentions",
    "last_filed_at",
    "auto_discovered",
  ].join(",");

  const rows = banks.map((b) =>
    [
      csv(b.ticker),
      csv(b.name),
      csv(b.tier),
      csv(b.status),
      csv(b.confidence),
      csv(String(b.filings)),
      csv(String(b.signals)),
      csv(String(b.news)),
      csv(b.last_filed_at),
      csv(b.auto_discovered ? "true" : "false"),
    ].join(",")
  );

  // Prepend a comment line with provenance + filter context. Excel ignores
  // lines starting with # only when imported via "from text" — but the
  // OPTIONAL convention in CSV is generally that the consumer skips lines
  // starting with #. Put the comment AS an in-CSV "metadata" prefix row
  // instead, formatted so it parses cleanly: single column with quoted text.
  const meta = [
    `"# tradeline.io · banks export · generated ${new Date().toISOString()}"`,
    `"# snapshot ${snap.generated_at || "(unknown)"} · status=${statusFilter || "all"} · tier=${tierFilter || "all"} · ${banks.length} rows"`,
  ].join("\n");

  const body = `${meta}\n${header}\n${rows.join("\n")}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tradeline-banks${statusFilter ? `-${statusFilter}` : ""}.csv"`,
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
  // Always quote — handles commas, newlines, double-quotes inside the value.
  // Newlines are escaped to spaces to keep each row on one line.
  const cleaned = String(value).replace(/\r?\n/g, " ");
  return `"${cleaned.replace(/"/g, '""')}"`;
}
