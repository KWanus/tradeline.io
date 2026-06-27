import "server-only";

import { NextResponse } from "next/server";

import { appendDnc, readDncList, removeDnc } from "@/lib/dnc-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

/** GET — the do-not-contact list for the UI. Read-only, no auth. */
export async function GET() {
  const entries = await readDncList();
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST { action: "add" | "remove", email, bankKey?, reason? } — manage the
 * suppression list. CRON_SECRET gated.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { action?: string; email?: string; bankKey?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const action = body.action?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (action !== "add" && action !== "remove") {
    return NextResponse.json(
      { error: "action must be 'add' or 'remove'" },
      { status: 400 }
    );
  }

  const res =
    action === "add"
      ? await appendDnc({ email, bankKey: body.bankKey, reason: body.reason })
      : await removeDnc(email);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason || "write failed" }, { status: 500 });
  }
  const entries = await readDncList();
  return NextResponse.json({ ok: true, entries });
}
