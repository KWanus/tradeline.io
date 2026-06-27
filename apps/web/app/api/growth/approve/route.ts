import "server-only";

import { NextResponse } from "next/server";

import { sendApprovedLead } from "@/lib/growth/runner";
import { updateLead } from "@/lib/growth/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

/**
 * POST { id, action: "send" | "skip", subject?, body? }
 *   - "send": ship the queued lead now (with optional edits) via Resend.
 *   - "skip": mark it skipped so it never sends and is excluded from re-discovery.
 * Gated by CRON_SECRET (same token the Autopilot UI already stores).
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { id?: string; action?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  const action = body.action?.trim();
  if (!id || (action !== "send" && action !== "skip")) {
    return NextResponse.json(
      { error: "id and action ('send'|'skip') required" },
      { status: 400 }
    );
  }

  if (action === "skip") {
    const res = await updateLead(id, { status: "skipped", error: null });
    if (!res.ok) {
      return NextResponse.json({ error: res.reason || "update failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, lead: res.lead });
  }

  const res = await sendApprovedLead(id, {
    subject: body.subject,
    body: body.body,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error || "send failed", lead: res.lead },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, lead: res.lead });
}
