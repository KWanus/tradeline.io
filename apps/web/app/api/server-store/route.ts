import { NextResponse } from "next/server";
import {
  SYNCABLE_STORES,
  readStore,
  writeStore,
  type SyncableStore,
} from "@/lib/server-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/server-store?store=returns&tenant=default
// → returns the raw JSON from the data branch (or 404 if never synced)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeParam = url.searchParams.get("store");
  const tenant = url.searchParams.get("tenant") ?? "default";

  if (!storeParam || !SYNCABLE_STORES.includes(storeParam as SyncableStore)) {
    return NextResponse.json(
      { error: `Invalid 'store'. Must be one of: ${SYNCABLE_STORES.join(", ")}` },
      { status: 400 }
    );
  }
  const result = await readStore(storeParam as SyncableStore, tenant);
  if (!result.ok) {
    if (result.status === 404) {
      return NextResponse.json(
        { ok: false, reason: "no remote backup yet" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, data: result.data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// POST /api/server-store
// body: { store: "returns", tenant?: "default", data: unknown }
// → writes the data to data-branch path server-stores/{tenant}/{store}.json
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const store = (body as { store?: string })?.store;
  const tenant = (body as { tenant?: string })?.tenant ?? "default";
  const data = (body as { data?: unknown })?.data;

  if (!store || !SYNCABLE_STORES.includes(store as SyncableStore)) {
    return NextResponse.json(
      { error: `Invalid 'store'. Must be one of: ${SYNCABLE_STORES.join(", ")}` },
      { status: 400 }
    );
  }
  if (data === undefined) {
    return NextResponse.json({ error: "Missing 'data'" }, { status: 400 });
  }
  const result = await writeStore(store as SyncableStore, data, tenant);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: result.status ?? 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, sha: result.sha },
    { headers: { "Cache-Control": "no-store" } }
  );
}
