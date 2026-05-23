import "server-only";

import Stripe from "stripe";
import type { SubscriberPlan } from "./subscribers";

let _client: Stripe | null = null;

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (_client) return _client;
  _client = new Stripe(key);
  return _client;
}

/**
 * Maps our subscriber plans to Stripe Price IDs set via env vars. Each price
 * is created once in the Stripe dashboard for the recurring monthly amount
 * listed in PLAN_DETAILS, then its ID gets pasted into env.
 *
 * The `trial` plan has no Stripe price — it's the 14-day no-card flow.
 */
export function stripePriceFor(plan: SubscriberPlan): string | null {
  switch (plan) {
    case "starter":
      return process.env.STRIPE_PRICE_STARTER || null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO || null;
    case "enterprise":
      return process.env.STRIPE_PRICE_ENTERPRISE || null;
    case "fund-of-funds":
      return process.env.STRIPE_PRICE_FUND_OF_FUNDS || null;
    case "trial":
      return null;
  }
}
