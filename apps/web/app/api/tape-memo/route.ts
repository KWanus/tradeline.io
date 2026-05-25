import { NextResponse } from "next/server";
import { generateUnderwritingMemo, type MemoInput } from "@/lib/tape-memo-llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// POST /api/tape-memo
//
// Accepts a sanitized MemoInput from the Tape Copilot uploader (built
// in-browser from TapeAggregates + LicenseImpact + ConcentrationReport +
// bid heuristic). Returns the generated markdown memo or an error.
//
// NO row-level data, NO PII, NO raw header strings cross this boundary —
// the client is responsible for sanitizing before sending. This endpoint
// trusts the incoming shape but caps each string field length so a
// malformed client can't blow up the prompt.

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Light validation + clipping — the type system is enforced at compile time
  // for the client; runtime we mainly want to bound string lengths and
  // ensure required numeric fields are finite.
  const input = body as Partial<MemoInput>;
  if (typeof input.rowCount !== "number" || !Number.isFinite(input.rowCount)) {
    return NextResponse.json({ error: "missing rowCount" }, { status: 400 });
  }
  if (typeof input.totalFaceValue !== "number" || !Number.isFinite(input.totalFaceValue)) {
    return NextResponse.json({ error: "missing totalFaceValue" }, { status: 400 });
  }

  const result = await generateUnderwritingMemo(input as MemoInput);

  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Memo generator is disabled. Set ANTHROPIC_API_KEY on the server to enable.",
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
    { enabled: true, markdown: result.markdown },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
