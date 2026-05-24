import "server-only";

import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilot/runner";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Resolving + personalizing + sending up to 20 emails serially can take a
// while. Cap at 5 min (Vercel's max for cron) so the function doesn't time
// out mid-batch.
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runAutopilot();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
