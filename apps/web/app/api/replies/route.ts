import "server-only";

import { NextResponse } from "next/server";

import { markReplyHandled, readInbox, updateReply } from "@/lib/replies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

/** GET — the reply inbox for the UI. Read-only, no auth. */
export async function GET() {
  const replies = await readInbox();
  return NextResponse.json({ replies }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST { id, action: "handle" | "reopen" } — mark a reply handled (clears it
 * from the pending queue) or reopen it. CRON_SECRET gated, same token the
 * Autopilot / Growth UIs store.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const action = body.action?.trim();
  if (!id || (action !== "handle" && action !== "reopen")) {
    return NextResponse.json(
      { error: "id and action ('handle'|'reopen') required" },
      { status: 400 }
    );
  }

  const res =
    action === "handle"
      ? await markReplyHandled(id)
      : await updateReply(id, { handledAt: undefined });
  if (!res.ok) {
    return NextResponse.json({ error: res.reason || "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, reply: res.reply });
}
