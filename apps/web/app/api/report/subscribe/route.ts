import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SubscribeBody = {
  email: string;
  name?: string;
  type?: string;
};

const LEADS_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "report_leads.jsonl"
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "valid email required" },
      { status: 400 }
    );
  }
  if (email.length > 320) {
    return NextResponse.json({ ok: false, error: "email too long" }, { status: 400 });
  }

  const lead = {
    email,
    name: (body.name || "").trim().slice(0, 200),
    type: (body.type || "other").slice(0, 32),
    source: "report_landing",
    submittedAt: new Date().toISOString(),
  };

  // Persist server-side as JSONL so the founder can grep / pipe to Mailchimp
  // / Beehiiv / ConvertKit when they wire a real ESP. Best-effort — if the
  // data dir doesn't exist the request still succeeds.
  try {
    await fs.mkdir(path.dirname(LEADS_PATH), { recursive: true });
    await fs.appendFile(LEADS_PATH, JSON.stringify(lead) + "\n", "utf-8");
  } catch (err) {
    console.warn("[report/subscribe] failed to persist lead:", (err as Error).message);
  }

  // Optionally notify the founder via Resend if the key is configured.
  if (process.env.RESEND_API_KEY) {
    const operatorEmail = process.env.REPORT_LEADS_NOTIFY_TO;
    if (operatorEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || "Tradeline <onboarding@resend.dev>",
            to: [operatorEmail],
            subject: `New report subscriber: ${lead.email}`,
            text: `New subscriber to the 31-Bank Charge-Off Report.\n\nEmail: ${lead.email}\nName: ${lead.name || "(not given)"}\nType: ${lead.type}\nAt: ${lead.submittedAt}\n\nFull lead log: data/output/report_leads.jsonl`,
          }),
        });
      } catch {
        // Non-blocking — even if email notification fails, lead is recorded
      }
    }
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
