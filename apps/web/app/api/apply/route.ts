import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApplyBody = {
  email?: string;
  name?: string;
  firm?: string;
  role?: string;
  state?: string;
  volume?: string;
  interest?: string;
  referral?: string;
};

const APPS_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "applications.jsonl"
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trim(s: string | undefined, max: number): string {
  return (s || "").trim().slice(0, max);
}

const ROLE_LABEL: Record<string, string> = {
  buyer: "Licensed debt buyer (or in license process)",
  broker: "Broker / loan-sale advisor",
  lender: "Hypothecation lender",
  attorney: "Consumer-finance attorney",
  cpa: "Receivables-specialty CPA",
  founder: "Founder/operator at a related business",
  other: "Other",
};

const VOLUME_LABEL: Record<string, string> = {
  pre: "Not buying yet — getting licensed",
  lt1m: "Under $1M face / month",
  "1to5m": "$1M–$5M face / month",
  "5to25m": "$5M–$25M face / month",
  "25mplus": "$25M+ face / month",
  na: "Not a buyer (broker / lender / attorney / CPA)",
};

export async function POST(req: Request) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON" },
      { status: 400 }
    );
  }

  const email = (body.email || "").trim().toLowerCase();
  const name = trim(body.name, 200);
  const firm = trim(body.firm, 200);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "valid email required" },
      { status: 400 }
    );
  }
  if (email.length > 320) {
    return NextResponse.json(
      { ok: false, error: "email too long" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "name required" },
      { status: 400 }
    );
  }
  if (!firm) {
    return NextResponse.json(
      { ok: false, error: "firm required" },
      { status: 400 }
    );
  }

  const role = ROLE_LABEL[body.role || "buyer"] ? body.role || "buyer" : "other";
  const volume = VOLUME_LABEL[body.volume || "lt1m"]
    ? body.volume || "lt1m"
    : "lt1m";

  const application = {
    email,
    name,
    firm,
    role,
    state: trim(body.state, 64),
    volume,
    interest: trim(body.interest, 1500),
    referral: trim(body.referral, 200),
    submittedAt: new Date().toISOString(),
    source: "apply_form",
  };

  // Persist server-side — best-effort. Same pattern as /report/subscribe.
  try {
    await fs.mkdir(path.dirname(APPS_PATH), { recursive: true });
    await fs.appendFile(
      APPS_PATH,
      JSON.stringify(application) + "\n",
      "utf-8"
    );
  } catch (err) {
    console.warn("[apply] persist failed:", (err as Error).message);
  }

  // Notify the founder via Resend if configured. Non-blocking.
  let founderNotified = false;
  if (process.env.RESEND_API_KEY) {
    const operator = process.env.REPORT_LEADS_NOTIFY_TO;
    if (operator) {
      try {
        const from =
          process.env.RESEND_FROM || "Tradeline <onboarding@resend.dev>";
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [operator],
            reply_to: application.email,
            subject: `[design partner] ${application.firm} — ${application.name}`,
            text: [
              `New design-partner application.`,
              ``,
              `Name:    ${application.name}`,
              `Email:   ${application.email}`,
              `Firm:    ${application.firm}`,
              `Role:    ${ROLE_LABEL[application.role] || application.role}`,
              `State:   ${application.state || "(none)"}`,
              `Volume:  ${VOLUME_LABEL[application.volume] || application.volume}`,
              `Referral:${application.referral ? " " + application.referral : " (none)"}`,
              ``,
              `What they want from Tradeline:`,
              application.interest ? application.interest : "(none provided)",
              ``,
              `Submitted: ${application.submittedAt}`,
              ``,
              `Full log: data/output/applications.jsonl`,
              `Reply directly — replies route back to ${application.email}.`,
              `Workbase: ${siteUrl}/app/today`,
            ].join("\n"),
          }),
        });
        founderNotified = r.ok;
      } catch {
        // non-blocking
      }
    }
  }

  return NextResponse.json(
    { ok: true, founderNotified },
    { headers: { "Cache-Control": "no-store" } }
  );
}
