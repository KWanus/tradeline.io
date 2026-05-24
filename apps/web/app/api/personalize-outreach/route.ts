import { NextResponse } from "next/server";

import { EMPTY_PROFILE, type BuyerProfile } from "@/lib/buyer-profile";
import { personalizeOutreach } from "@/lib/personalize-llm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function trimToProfile(raw: unknown): BuyerProfile {
  if (!raw || typeof raw !== "object") return EMPTY_PROFILE;
  const r = raw as Record<string, unknown>;
  const str = (k: keyof BuyerProfile): string =>
    typeof r[k] === "string" ? (r[k] as string) : "";
  return {
    yourName: str("yourName"),
    firmName: str("firmName"),
    state: str("state"),
    licenseNumber: str("licenseNumber"),
    bondCarrier: str("bondCarrier"),
    bondAmount: str("bondAmount"),
    servicer: str("servicer"),
    ticketRange: str("ticketRange"),
    assetFocus: str("assetFocus"),
    phone: str("phone"),
    email: str("email"),
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const b = (body || {}) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const draft = typeof b.draft === "string" ? b.draft.trim() : "";
  if (!subject || !draft) {
    return NextResponse.json(
      { enabled: true, error: "subject and draft required" },
      { status: 400 }
    );
  }

  const bankName =
    typeof b.bankName === "string" ? b.bankName.slice(0, 200) : undefined;
  const bankKey =
    typeof b.bankKey === "string" ? b.bankKey.slice(0, 200) : undefined;

  const result = await personalizeOutreach({
    subject: subject.slice(0, 500),
    draft: draft.slice(0, 8000),
    bankName,
    bankKey,
    profile: trimToProfile(b.profile),
  });

  if (result.kind === "disabled") {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "AI personalize is disabled. Set ANTHROPIC_API_KEY on the server to enable it.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (result.kind === "error") {
    return NextResponse.json(
      { enabled: true, error: result.message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    {
      enabled: true,
      subject: result.subject,
      draft: result.draft,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
