import "server-only";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const to = (body as { to?: string })?.to?.trim();
  const subject = (body as { subject?: string })?.subject?.trim();
  const text = (body as { text?: string })?.text?.trim();
  const replyTo = (body as { replyTo?: string })?.replyTo?.trim();

  if (!to || !subject || !text) {
    return NextResponse.json(
      { enabled: true, error: "Missing required fields (to, subject, text)" },
      { status: 400 }
    );
  }

  // Basic email sanity
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json(
      { enabled: true, error: `Invalid recipient: ${to}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Auto-send is disabled. Set RESEND_API_KEY (and RESEND_FROM for a verified domain) on the server to enable.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;

  // Refuse obvious test addresses so we don't burn quota on bounces
  if (to.includes(".example") || to.includes("@example.com")) {
    return NextResponse.json(
      {
        enabled: true,
        error: `Recipient ${to} looks like a test address — skipped.`,
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        {
          enabled: true,
          error: `Resend ${response.status}: ${errText.slice(0, 300)}`,
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { id?: string };
    return NextResponse.json(
      {
        enabled: true,
        sent: true,
        provider: "resend",
        providerMessageId: data.id || "",
        from,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        enabled: true,
        error: (err as Error).message || "fetch failed",
      },
      { status: 502 }
    );
  }
}
