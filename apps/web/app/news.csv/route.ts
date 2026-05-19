import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Spreadsheet-friendly export of every bank-matched headline. Same data
 * as /api/news, shaped for direct download into Excel / Google Sheets /
 * Airtable / Pandas.
 *
 * Query params:
 *   ?ticker=COF     filter to one bank (case-insensitive)
 *   ?limit=N        cap row count (default 200, max 1000)
 */
export async function GET(req: Request) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const url = new URL(req.url);
  const tickerFilter = (url.searchParams.get("ticker") || "").trim().toUpperCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 1000)
      : 200;

  let items = (snap.matched_news || []).slice().sort((a, b) => {
    const ta = new Date(a.published_at).getTime();
    const tb = new Date(b.published_at).getTime();
    return (tb || 0) - (ta || 0);
  });
  if (tickerFilter) {
    items = items.filter((n) => (n.matched_tickers || []).includes(tickerFilter));
  }
  items = items.slice(0, limit);

  const header = [
    "published_at",
    "tickers",
    "title",
    "publisher",
    "link",
    "source_id",
  ].join(",");

  const rows = items.map((n) =>
    [
      csv(n.published_at || ""),
      csv((n.matched_tickers || []).join("|")),
      csv(n.title || ""),
      csv(n.publisher || ""),
      csv(n.link || ""),
      csv(n.source_id || ""),
    ].join(",")
  );

  const meta = [
    `"# tradeline.io · news export · generated ${new Date().toISOString()}"`,
    `"# snapshot ${snap.generated_at || "(unknown)"} · ticker=${tickerFilter || "all"} · ${items.length} rows"`,
  ].join("\n");

  const body = `${meta}\n${header}\n${rows.join("\n")}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tradeline-news${tickerFilter ? `-${tickerFilter.toLowerCase()}` : ""}.csv"`,
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
