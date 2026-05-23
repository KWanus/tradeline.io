import "server-only";

import { NextResponse } from "next/server";
import { stripe, stripePriceFor } from "@/lib/stripe";
import { PLAN_DETAILS, type SubscriberPlan } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_PLANS: SubscriberPlan[] = ["starter", "pro", "enterprise", "fund-of-funds"];

function originFromReq(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (env) {
    return env.startsWith("http") ? env : `https://${env}`;
  }
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
  const customerEmail = (body as { email?: string })?.email?.trim();

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
          "Stripe checkout is disabled. Set STRIPE_SECRET_KEY (and per-plan STRIPE_PRICE_* env vars) to enable.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const price = stripePriceFor(plan);
  if (!price) {
    return NextResponse.json(
      {
        enabled: false,
        message: `STRIPE_PRICE_${plan.toUpperCase().replace(/-/g, "_")} env var is not set. Create a Stripe Price for the ${PLAN_DETAILS[plan].label} plan ($${PLAN_DETAILS[plan].mrrUsd}/mo recurring) and paste its ID.`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const origin = originFromReq(req);

  try {
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/app/subscribers?stripe=success&plan=${plan}`,
      cancel_url: `${origin}/app/marketplace?stripe=cancel`,
      allow_promotion_codes: true,
      customer_email: customerEmail || undefined,
      subscription_data: {
        metadata: { plan },
      },
      metadata: { plan },
    });

    return NextResponse.json(
      { url: session.url, id: session.id },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "stripe error" },
      { status: 502 }
    );
  }
}
