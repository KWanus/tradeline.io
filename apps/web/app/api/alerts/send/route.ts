import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import { buildAlert } from "@/lib/alert-templates";
import { deliverAlert } from "@/lib/alert-delivery";
import type { Subscriber } from "@/lib/subscribers";
import type { SecSignal } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SendRequestBody = {
  subscribers: Subscriber[];
  // If set, only consider these signal source_ids (for sample-alert mode)
  signalIds?: string[];
};

type SentItem = {
  subscriberId: string;
  subscriberOrg: string;
  recipientAddress: string;
  channel: Subscriber["preferences"]["deliveryChannel"];
  subject: string;
  signalSourceId: string;
  signalTicker: string;
  signalType: string;
  confidence: number;
  status: "sent" | "preview" | "failed";
  failureReason?: string;
  // Full HTML body returned for preview-mode rendering on the dashboard
  htmlPreview?: string;
};

function matches(s: SecSignal, sub: Subscriber): boolean {
  if (sub.preferences.tickers.length > 0 && !sub.preferences.tickers.includes(s.ticker)) {
    return false;
  }
  if (
    sub.preferences.signalTypes.length > 0 &&
    !sub.preferences.signalTypes.includes(s.signal_type)
  ) {
    return false;
  }
  if (s.confidence < sub.preferences.minConfidence) return false;
  return true;
}

export async function POST(req: Request) {
  let body: SendRequestBody;
  try {
    body = (await req.json()) as SendRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.subscribers) || body.subscribers.length === 0) {
    return NextResponse.json(
      { error: "subscribers array required" },
      { status: 400 }
    );
  }

  const snap = await readSnapshot();
  let signals = snap.top_signals;
  if (body.signalIds && body.signalIds.length > 0) {
    signals = signals.filter((s) => body.signalIds!.includes(s.source_id));
  }

  const results: SentItem[] = [];

  for (const sub of body.subscribers) {
    const matched = signals.filter((s) => matches(s, sub));
    for (const sig of matched) {
      const alert = buildAlert(sig, sub);
      const delivery = await deliverAlert(
        sub.preferences.deliveryChannel,
        sub.preferences.deliveryAddress,
        alert
      );
      const item: SentItem = {
        subscriberId: sub.id,
        subscriberOrg: sub.orgName,
        recipientAddress: sub.preferences.deliveryAddress,
        channel: sub.preferences.deliveryChannel,
        subject: alert.subject,
        signalSourceId: sig.source_id,
        signalTicker: sig.ticker,
        signalType: sig.signal_type,
        confidence: sig.confidence,
        status:
          delivery.kind === "sent"
            ? "sent"
            : delivery.kind === "preview"
            ? "preview"
            : "failed",
        failureReason:
          delivery.kind === "preview"
            ? delivery.reason
            : delivery.kind === "failed"
            ? delivery.error
            : undefined,
        htmlPreview: delivery.kind === "preview" ? alert.html : undefined,
      };
      results.push(item);
    }
  }

  const summary = {
    sent: results.filter((r) => r.status === "sent").length,
    preview: results.filter((r) => r.status === "preview").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return NextResponse.json(
    { ok: true, summary, results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
