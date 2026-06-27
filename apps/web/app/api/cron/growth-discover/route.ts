import "server-only";

import { NextResponse } from "next/server";

import { runGrowthDiscovery } from "@/lib/growth/runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Web search + batched drafting (+ optional auto-send) can run long. Cap at
// Vercel's 5-min cron max.
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

async function run(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runGrowthDiscovery();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
