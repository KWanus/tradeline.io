import "server-only";

import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import { buildWeeklyDigest } from "@/lib/report-digest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SendBody = {
  recipients?: string[];
  testEmail?: string;
};

type SendResult = {
  email: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, enabled: false, error: "RESEND_API_KEY not configured" },
      { status: 200 }
    );
  }

  const from =
    process.env.RESEND_FROM || "Tradeline <onboarding@resend.dev>";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";

  const snap = await readSnapshot();
  const digest = buildWeeklyDigest(snap, { siteUrl });

  // Determine the recipient list.
  let recipients: string[] = [];
  if (body.testEmail) {
    const e = body.testEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      return NextResponse.json(
        { ok: false, error: "invalid testEmail" },
        { status: 400 }
      );
    }
    recipients = [e];
  } else if (Array.isArray(body.recipients) && body.recipients.length > 0) {
    recipients = Array.from(
      new Set(
        body.recipients
          .map((r) => r.trim().toLowerCase())
          .filter((r) => EMAIL_RE.test(r))
      )
    );
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no valid recipients" },
      { status: 400 }
    );
  }

  // Resend Batch API supports up to 100 emails per call.
  const results: SendResult[] = [];
  const CHUNK = 100;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    const payload = slice.map((to) => ({
      from,
      to: [to],
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
      headers: {
        "List-Unsubscribe": `<mailto:${
          process.env.REPORT_LEADS_NOTIFY_TO || "unsubscribe@tradeline.io"
        }?subject=unsubscribe%20${encodeURIComponent(to)}>`,
      },
    }));

    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await r.json().catch(() => ({}))) as {
        data?: Array<{ id: string }>;
        message?: string;
        error?: string;
      };
      if (!r.ok) {
        const errMsg = data.message || data.error || `HTTP ${r.status}`;
        for (const to of slice) {
          results.push({ email: to, status: "failed", error: errMsg });
        }
        continue;
      }
      const ids = data.data || [];
      slice.forEach((to, idx) => {
        results.push({
          email: to,
          status: "sent",
          providerMessageId: ids[idx]?.id,
        });
      });
    } catch (err) {
      const errMsg = (err as Error).message;
      for (const to of slice) {
        results.push({ email: to, status: "failed", error: errMsg });
      }
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;

  return NextResponse.json(
    {
      ok: true,
      enabled: true,
      subject: digest.subject,
      stats: digest.stats,
      sent,
      failed,
      results,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
