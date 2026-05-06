import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const snap = await readSnapshot();
  return NextResponse.json(snap, {
    headers: { "Cache-Control": "no-store" },
  });
}
