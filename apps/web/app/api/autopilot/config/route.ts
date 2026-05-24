import "server-only";

import { NextResponse } from "next/server";
import {
  readState,
  writeState,
  type Audience,
  type AutopilotState,
} from "@/lib/autopilot/state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

const VALID_AUDIENCES: Audience[] = ["sec", "fdic", "ncua"];

export async function GET() {
  // State is non-sensitive (no API keys, no PII), so we expose it to anyone
  // who lands on /app/autopilot. Authorization is only on write.
  const state = await readState();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<AutopilotState> & {
    action?: "pause" | "resume" | "ping-login";
  };

  const updates: Partial<AutopilotState> = {};

  if (typeof b.enabled === "boolean") updates.enabled = b.enabled;
  if (typeof b.dryRun === "boolean") updates.dryRun = b.dryRun;

  if (typeof b.dailyCap === "number" && b.dailyCap >= 1 && b.dailyCap <= 20) {
    updates.dailyCap = Math.floor(b.dailyCap);
  }

  if (Array.isArray(b.audiences)) {
    const cleaned = b.audiences.filter((a): a is Audience =>
      (VALID_AUDIENCES as string[]).includes(a)
    );
    if (cleaned.length > 0) updates.audiences = cleaned;
  }

  if (typeof b.customTemplate === "string") {
    // Empty string clears the custom template (revert to defaults).
    updates.customTemplate = b.customTemplate.trim() || null;
  } else if (b.customTemplate === null) {
    updates.customTemplate = null;
  }

  if (b.action === "pause") {
    updates.pausedReason = "manually paused";
  } else if (b.action === "resume") {
    updates.pausedReason = null;
  } else if (b.action === "ping-login") {
    // Called by /app/today on every visit so the auto-pause-after-7-days
    // safety can tell the operator is still active.
    updates.lastLoginAt = new Date().toISOString();
  }

  const result = await writeState(updates);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason || "write failed" },
      { status: 502 }
    );
  }

  const next = await readState();
  return NextResponse.json(next, {
    headers: { "Cache-Control": "no-store" },
  });
}
