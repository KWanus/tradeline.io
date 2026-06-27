import "server-only";

import { NextResponse } from "next/server";

import { readGrowth, writeConfig, type GrowthConfig } from "@/lib/growth/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

/** GET — the queue + config for the approval UI. Read-only, no auth. */
export async function GET() {
  const store = await readGrowth();
  return NextResponse.json(store, { headers: { "Cache-Control": "no-store" } });
}

/** POST — update config (enable, autoApprove, segments, caps…). CRON_SECRET. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Partial<GrowthConfig>;
  try {
    body = (await req.json()) as Partial<GrowthConfig>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Whitelist the fields a client may set.
  const updates: Partial<GrowthConfig> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.autoApprove === "boolean") updates.autoApprove = body.autoApprove;
  if (typeof body.dailyDiscoverTarget === "number")
    updates.dailyDiscoverTarget = Math.max(1, Math.min(50, Math.round(body.dailyDiscoverTarget)));
  if (typeof body.dailyCap === "number")
    updates.dailyCap = Math.max(0, Math.min(100, Math.round(body.dailyCap)));
  if (Array.isArray(body.segments)) updates.segments = body.segments;
  if (typeof body.geo === "string") updates.geo = body.geo.slice(0, 120);
  if (Array.isArray(body.states))
    updates.states = body.states
      .filter((s): s is string => typeof s === "string" && /^[A-Za-z]{2}$/.test(s))
      .map((s) => s.toUpperCase())
      .slice(0, 56);
  if (Array.isArray(body.areaCodes))
    updates.areaCodes = body.areaCodes
      .filter((c): c is string => typeof c === "string" && /^\d{3}$/.test(c))
      .slice(0, 100);
  if (typeof body.pausedReason === "string" || body.pausedReason === null)
    updates.pausedReason = body.pausedReason;

  const res = await writeConfig(updates);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason || "write failed" }, { status: 500 });
  }
  const store = await readGrowth();
  return NextResponse.json({ ok: true, config: store.config });
}
