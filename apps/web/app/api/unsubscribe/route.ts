import "server-only";

import { NextResponse } from "next/server";
import { appendUnsubscribe, isUnsubscribed } from "@/lib/report-leads";
import { verifyUnsubToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function unsubscribe(
  email: string,
  token: string,
  reason?: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "valid email required" },
    };
  }
  if (!token || !verifyUnsubToken(trimmed, token)) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "invalid or expired token" },
    };
  }
  if (await isUnsubscribed(trimmed)) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, alreadyUnsubscribed: true, email: trimmed },
    };
  }
  try {
    await appendUnsubscribe(trimmed, reason);
    return {
      ok: true,
      status: 200,
      body: { ok: true, email: trimmed },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      body: { ok: false, error: (err as Error).message },
    };
  }
}

export async function POST(req: Request) {
  // Two POST callers:
  //   1. Gmail one-click "List-Unsubscribe-Post: List-Unsubscribe=One-Click" —
  //      sends application/x-www-form-urlencoded with email + token query string.
  //   2. The /unsubscribe page form — JSON body.
  const url = new URL(req.url);
  let email = url.searchParams.get("email") || "";
  let token = url.searchParams.get("token") || "";
  let reason: string | undefined;

  if (!email || !token) {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      try {
        const body = (await req.json()) as {
          email?: string;
          token?: string;
          reason?: string;
        };
        email = email || body.email || "";
        token = token || body.token || "";
        reason = body.reason;
      } catch {
        // fall through
      }
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      try {
        const text = await req.text();
        const form = new URLSearchParams(text);
        email = email || form.get("email") || "";
        token = token || form.get("token") || "";
        reason = form.get("reason") || undefined;
      } catch {
        // fall through
      }
    }
  }

  const result = await unsubscribe(email, token, reason);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  // Gmail "View" / direct-click can hit GET. Accept and treat the same.
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("token") || "";
  const result = await unsubscribe(email, token);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
