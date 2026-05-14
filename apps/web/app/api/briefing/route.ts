import { NextResponse } from "next/server";
import { generateBriefing } from "@/lib/briefing-llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const userContext =
    typeof (body as { userContext?: unknown })?.userContext === "string"
      ? ((body as { userContext: string }).userContext as string).slice(0, 6000)
      : "";

  const radarContext =
    typeof (body as { radarContext?: unknown })?.radarContext === "string"
      ? ((body as { radarContext: string }).radarContext as string).slice(0, 4000)
      : "";

  const enableResearch =
    (body as { enableResearch?: unknown })?.enableResearch === true;

  const result = await generateBriefing({
    userContext,
    radarContext,
    enableResearch,
  });

  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Daily briefing is disabled. Set ANTHROPIC_API_KEY on the server to enable.",
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
      text: result.text,
      citations: result.citations,
      searched: result.searched,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
