import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import { buildWelcomeEmail } from "@/lib/report-digest";

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

  // If Resend is configured, send (a) the welcome email to the new subscriber
  // — they get this week's digest immediately so they don't have to wait until
  // Monday — and (b) a notification to the founder. Both are best-effort; lead
  // is recorded regardless.
  let welcomeSent = false;
  if (process.env.RESEND_API_KEY) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Tradeline <onboarding@resend.dev>";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";

    // (a) Welcome email to the new subscriber.
    try {
      const snap = await readSnapshot();
      const welcome = buildWelcomeEmail(snap, lead, { siteUrl });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [lead.email],
          subject: welcome.subject,
          html: welcome.html,
          text: welcome.text,
          headers: {
            "List-Unsubscribe": `<mailto:${
              process.env.REPORT_LEADS_NOTIFY_TO || "unsubscribe@tradeline.io"
            }?subject=unsubscribe%20${encodeURIComponent(lead.email)}>`,
          },
        }),
      });
      welcomeSent = r.ok;
    } catch (err) {
      console.warn("[report/subscribe] welcome send failed:", (err as Error).message);
    }

    // (b) Notify the founder.
    const operatorEmail = process.env.REPORT_LEADS_NOTIFY_TO;
    if (operatorEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [operatorEmail],
            subject: `New report subscriber: ${lead.email}`,
            text: `New subscriber to the Tradeline weekly Charge-Off Report.\n\nEmail: ${lead.email}\nName: ${lead.name || "(not given)"}\nType: ${lead.type}\nAt: ${lead.submittedAt}\nWelcome email sent: ${welcomeSent ? "yes" : "no"}\n\nFull lead log: data/output/report_leads.jsonl\nSend manually anytime: ${process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"}/app/report-leads`,
          }),
        });
      } catch {
        // Non-blocking
      }
    }
  }

  return NextResponse.json(
    { ok: true, welcomeSent },
    { headers: { "Cache-Control": "no-store" } }
  );
}
