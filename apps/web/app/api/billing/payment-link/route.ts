import "server-only";

import { NextResponse } from "next/server";
import { stripe, stripePriceFor } from "@/lib/stripe";
import { PLAN_DETAILS, type SubscriberPlan } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Create a reusable Stripe Payment Link for a plan (PLAN P2-2).
 *
 * Unlike /api/billing/checkout (a one-shot Checkout Session), a Payment Link is
 * a durable URL the operator can paste into a renewal email. We tag it with the
 * customer id + plan in metadata so the Stripe webhook can reconcile the
 * conversion back to the right customer record.
 *
 * Returns `{ enabled: false }` (200) when Stripe isn't configured so the caller
 * can fall back to "reply and I'll send the link" copy without erroring.
 */

const VALID_PLANS: SubscriberPlan[] = [
  "starter",
  "pro",
  "enterprise",
  "fund-of-funds",
];

function originFromReq(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const plan = (body as { plan?: string })?.plan as SubscriberPlan | undefined;
  const customerId = (body as { customerId?: string })?.customerId?.trim();

  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(", ")}` },
      { status: 400 }
    );
  }

  const s = stripe();
  if (!s) {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Stripe is disabled. Set STRIPE_SECRET_KEY (and STRIPE_PRICE_* env vars) to generate payment links.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const price = stripePriceFor(plan);
  if (!price) {
    return NextResponse.json(
      {
        enabled: false,
        message: `STRIPE_PRICE_${plan
          .toUpperCase()
          .replace(/-/g, "_")} is not set. Create a Stripe Price for the ${
          PLAN_DETAILS[plan].label
        } plan and paste its ID.`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const origin = originFromReq(req);

  try {
    const link = await s.paymentLinks.create({
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        plan,
        ...(customerId ? { tradeline_customer_id: customerId } : {}),
      },
      subscription_data: {
        metadata: {
          plan,
          ...(customerId ? { tradeline_customer_id: customerId } : {}),
        },
      },
      after_completion: {
        type: "redirect",
        redirect: { url: `${origin}/app/subscribers?stripe=success&plan=${plan}` },
      },
    });

    return NextResponse.json(
      { enabled: true, url: link.url, id: link.id },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "stripe error" },
      { status: 502 }
    );
  }
}
