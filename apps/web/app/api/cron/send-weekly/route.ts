import "server-only";

import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import { buildWeeklyDigest } from "@/lib/report-digest";
import { readReportLeads } from "@/lib/report-leads";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SendResult = {
  email: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  // Accept both "Bearer X" and bare token. GitHub Actions and Vercel cron use
  // the Authorization header — bare-token form is convenient for curl tests.
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

async function runWeeklySend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      enabled: false,
      reason: "RESEND_API_KEY not configured" as const,
    };
  }

  const leads = await readReportLeads();
  const recipients = Array.from(
    new Set(
      leads
        .map((l) => l.email.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    )
  );

  if (recipients.length === 0) {
    return {
      ok: true,
      enabled: true,
      skipped: true,
      reason: "no subscribers" as const,
      sent: 0,
      failed: 0,
    };
  }

  const from = process.env.RESEND_FROM || "Tradeline <onboarding@resend.dev>";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";
  const snap = await readSnapshot();
  const digest = buildWeeklyDigest(snap, { siteUrl });

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
      for (const to of slice) {
        results.push({
          email: to,
          status: "failed",
          error: (err as Error).message,
        });
      }
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;

  // Best-effort founder notification — so you know the cron actually fired.
  const operator = process.env.REPORT_LEADS_NOTIFY_TO;
  if (operator && EMAIL_RE.test(operator)) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [operator],
          subject: `[cron] Weekly digest sent · ${sent}/${recipients.length} delivered`,
          text: [
            `Tradeline weekly digest cron fired.`,
            ``,
            `Subject: ${digest.subject}`,
            `Recipients: ${recipients.length}`,
            `Delivered: ${sent}`,
            `Failed: ${failed}`,
            ``,
            `Stats: ${digest.stats.strong} strong, ${digest.stats.watching} watching, ${digest.stats.signals} signals, ${digest.stats.news} news.`,
            ``,
            failed > 0
              ? `Failures:\n${results
                  .filter((r) => r.status === "failed")
                  .map((r) => `  - ${r.email}: ${r.error}`)
                  .join("\n")}`
              : `No failures.`,
          ].join("\n"),
        }),
      });
    } catch {
      // Notification is non-blocking
    }
  }

  return {
    ok: true,
    enabled: true,
    skipped: false,
    subject: digest.subject,
    recipients: recipients.length,
    sent,
    failed,
    stats: digest.stats,
    results,
  };
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  const result = await runWeeklySend();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

// Also accept GET so Vercel Cron / GitHub Actions can hit it with a simple
// curl. Auth is identical.
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  const result = await runWeeklySend();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
