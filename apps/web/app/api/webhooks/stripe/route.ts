import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { markConverted } from "@/lib/growth/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

async function forwardToOperator(args: { subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO;
  if (!apiKey || !notifyTo) return;
  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [notifyTo],
      subject: args.subject,
      text: args.text,
    }),
  });
}

function fmtAmount(cents: number | null | undefined, currency: string | null | undefined): string {
  if (typeof cents !== "number") return "(no amount)";
  const amount = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
  });
  return amount;
}

export async function POST(req: Request) {
  const s = stripe();
  if (!s) {
    return NextResponse.json(
      { error: "stripe not configured" },
      { status: 503 }
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 401 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = (session.metadata?.plan as string) || "(no plan tag)";
      const email = session.customer_details?.email || session.customer_email || "(no email)";
      const name = session.customer_details?.name || "";
      const amount = fmtAmount(session.amount_total, session.currency);
      // Attribute the signup back to a growth lead (best-effort, by email) so
      // the funnel can measure conversion. Most signups won't match a lead.
      let attributed = false;
      if (email && email !== "(no email)") {
        try {
          const res = await markConverted(email, plan);
          attributed = res.matched;
        } catch {}
      }
      await forwardToOperator({
        subject: `[NEW SUBSCRIBER] ${plan} — ${email}`,
        text:
          `A new Stripe subscription started.\n\n` +
          `Plan: ${plan}\n` +
          `Email: ${email}\n` +
          (name ? `Name: ${name}\n` : "") +
          `Amount: ${amount}/period\n` +
          (attributed ? `Attributed to a growth lead ✓ (see /app/growth funnel)\n` : "") +
          `Stripe customer: ${session.customer || "(none)"}\n` +
          `Stripe subscription: ${session.subscription || "(none)"}\n\n` +
          `Add them to /app/subscribers manually so alerts start flowing.`,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const plan = (sub.metadata?.plan as string) || "(no plan tag)";
      await forwardToOperator({
        subject: `[CANCELED] ${plan} subscription ended`,
        text:
          `A Stripe subscription has been canceled.\n\n` +
          `Plan: ${plan}\n` +
          `Customer: ${sub.customer}\n` +
          `Subscription: ${sub.id}\n` +
          `Status: ${sub.status}\n\n` +
          `Remove or mark inactive in /app/subscribers.`,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const email = invoice.customer_email || "(no email)";
      const amount = fmtAmount(invoice.amount_due, invoice.currency);
      await forwardToOperator({
        subject: `[PAYMENT FAILED] ${amount} — ${email}`,
        text:
          `A Stripe invoice failed to charge.\n\n` +
          `Email: ${email}\n` +
          `Amount due: ${amount}\n` +
          `Customer: ${invoice.customer}\n` +
          `Invoice: ${invoice.id}\n` +
          `Hosted invoice URL: ${invoice.hosted_invoice_url || "(none)"}\n\n` +
          `Stripe will auto-retry; if it fails again the subscription cancels.`,
      });
      break;
    }
  }

  return NextResponse.json(
    { received: true, type: event.type },
    { headers: { "Cache-Control": "no-store" } }
  );
}
