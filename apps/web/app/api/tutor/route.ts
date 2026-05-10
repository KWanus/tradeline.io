import { NextResponse } from "next/server";
import { askTutor, type TutorMessage } from "@/lib/tutor-llm";

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
  const messages = Array.isArray((body as { messages?: unknown })?.messages)
    ? ((body as { messages: TutorMessage[] }).messages as TutorMessage[])
    : null;
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  // Defensive: clamp to last 20 messages so context doesn't grow without bound
  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: typeof m.content === "string" ? m.content : "",
  }));

  const userContext =
    typeof (body as { userContext?: unknown })?.userContext === "string"
      ? ((body as { userContext: string }).userContext as string).slice(0, 8000)
      : undefined;

  const enableResearch =
    (body as { enableResearch?: unknown })?.enableResearch === true;

  const result = await askTutor(trimmed, { userContext, enableResearch });
  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "The AI tutor is disabled. Set ANTHROPIC_API_KEY on the server to enable it.",
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
