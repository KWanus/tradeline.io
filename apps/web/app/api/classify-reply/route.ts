import { NextResponse } from "next/server";
import { classifyBrokerReply } from "@/lib/classify-reply-llm";

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

  const brokerReply =
    typeof (body as { brokerReply?: unknown })?.brokerReply === "string"
      ? ((body as { brokerReply: string }).brokerReply as string).slice(0, 6000)
      : "";

  const userContext =
    typeof (body as { userContext?: unknown })?.userContext === "string"
      ? ((body as { userContext: string }).userContext as string).slice(0, 4000)
      : "";

  const bankContext =
    typeof (body as { bankContext?: unknown })?.bankContext === "string"
      ? ((body as { bankContext: string }).bankContext as string).slice(0, 1000)
      : "";

  const result = await classifyBrokerReply({ brokerReply, userContext, bankContext });

  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Reply classifier is disabled. Set ANTHROPIC_API_KEY on the server to enable.",
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
    { enabled: true, ...result.data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
