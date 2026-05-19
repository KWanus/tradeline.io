import { CHANGELOG } from "@/lib/changelog-entries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Spreadsheet-friendly export of every changelog entry.
 *
 * Query params:
 *   ?tag=<tag>       filter to entries that include the given tag
 *   ?limit=N         cap row count (default 100, max 500)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tagFilter = (url.searchParams.get("tag") || "").trim().toLowerCase();
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam)
      ? Math.min(parseInt(limitParam, 10), 500)
      : 100;

  let rows = CHANGELOG.map((e, idx) => ({
    anchor: `${e.date}-${idx}`,
    date: e.date,
    title: e.title,
    summary: e.summary || "",
    tags: (e.tags || []).join("|"),
    bullet_count: e.bullets.length,
  }));
  if (tagFilter) {
    const allowed = new Set(
      CHANGELOG.map((e, i) =>
        (e.tags || []).map((t) => t.toLowerCase()).includes(tagFilter)
          ? `${e.date}-${i}`
          : null
      ).filter(Boolean) as string[]
    );
    rows = rows.filter((r) => allowed.has(r.anchor));
  }
  rows = rows.slice(0, limit);

  const header = ["anchor", "date", "title", "summary", "tags", "bullet_count"].join(",");
  const data = rows.map((r) =>
    [
      csv(r.anchor),
      csv(r.date),
      csv(r.title),
      csv(r.summary),
      csv(r.tags),
      csv(String(r.bullet_count)),
    ].join(",")
  );

  const meta = [
    `"# tradeline.io · changelog export · generated ${new Date().toISOString()}"`,
    `"# tag=${tagFilter || "all"} · ${rows.length} rows · newest first"`,
  ].join("\n");

  const body = `${meta}\n${header}\n${data.join("\n")}\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tradeline-changelog${tagFilter ? `-${tagFilter}` : ""}.csv"`,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
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
