import "server-only";

import { NextResponse } from "next/server";
import { resolveContact } from "@/lib/contact-resolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Scraping multiple pages + a Claude extraction call can run 6-10s. Pad
// generously so cold starts don't truncate the response.
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const bankKey = (body as { bankKey?: string })?.bankKey?.trim();
  const companyName = (body as { companyName?: string })?.companyName?.trim();
  const domain = (body as { domain?: string })?.domain?.trim().toLowerCase();
  const roleHint = (body as { roleHint?: string })?.roleHint?.trim();

  if (!bankKey || !companyName) {
    return NextResponse.json(
      { error: "bankKey and companyName are required" },
      { status: 400 }
    );
  }

  const result = await resolveContact({
    bankKey,
    companyName,
    domain: domain || undefined,
    roleHint: roleHint || undefined,
  });

  return NextResponse.json(
    {
      bankKey,
      companyName,
      contacts: result.contacts,
      reason: result.contacts.length === 0 ? result.reason : undefined,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
