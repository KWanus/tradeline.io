import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import {
  buildBankContext,
  generateTalkingPoints,
} from "@/lib/talking-points-llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// JSON endpoint for the MCP server / external consumers. The bank detail
// page renders directly from a Server Component (Suspense), bypassing this
// route — but having it published means the same talking points can be
// queried from Claude Desktop or another agent.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  const snap = await readSnapshot();
  const originator = snap.originators.find((o) => o.ticker === ticker);
  if (!originator) {
    return NextResponse.json({ error: `unknown ticker: ${ticker}` }, { status: 404 });
  }

  const context = buildBankContext(originator, snap);
  const result = await generateTalkingPoints(context);

  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "ANTHROPIC_API_KEY not set on the server. Configure it to enable LLM-generated talking points.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (result.kind === "error") {
    return NextResponse.json(
      { enabled: true, error: result.message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    {
      enabled: true,
      ticker,
      generated_at: snap.generated_at,
      points: result.points,
    },
    {
      // Cache at the edge for 5 minutes — matches the prompt-cache TTL
      // and keeps repeat views cheap. Revalidate in the background so the
      // first user after the window doesn't pay the cold-start cost.
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    }
  );
}
