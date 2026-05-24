import "server-only";

import { NextResponse } from "next/server";

import { appendOutcome, type Outcome } from "@/lib/autopilot/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_OUTCOMES: Outcome[] = ["replied", "no_reply", "won_deal", "lost_deal"];

/** Same-origin guard. The inbox UI is the only legitimate caller; this
 * keeps drive-by spam from polluting the public log without requiring a
 * shared secret on the client side. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const bankKey = (body as { bankKey?: string })?.bankKey?.trim();
  const outcome = (body as { outcome?: string })?.outcome as Outcome | undefined;

  if (!bankKey) {
    return NextResponse.json(
      { error: "bankKey required" },
      { status: 400 }
    );
  }
  if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of ${VALID_OUTCOMES.join(", ")}` },
      { status: 400 }
    );
  }

  const res = await appendOutcome(bankKey, outcome);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.reason || "write failed" },
      { status: 502 }
    );
  }
  return NextResponse.json(
    { ok: true, updated: res.updated, reason: res.reason },
    { headers: { "Cache-Control": "no-store" } }
  );
}
