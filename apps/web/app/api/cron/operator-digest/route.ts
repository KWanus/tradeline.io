import "server-only";

import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return provided === secret;
}

function fmtRelDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const d = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export async function POST(req: Request) {
  return run(req);
}

// Vercel cron invokes via GET — accept both.
export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";

  if (!apiKey || !notifyTo) {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Operator digest disabled — set RESEND_API_KEY + REPORT_LEADS_NOTIFY_TO.",
      },
      { status: 200 }
    );
  }

  let snap;
  try {
    snap = await readSnapshot();
  } catch {
    return NextResponse.json({ error: "snapshot read failed" }, { status: 500 });
  }

  const strong = snap.originators.filter((o) => statusFor(o) === "strong");
  const watching = snap.originators.filter((o) => statusFor(o) === "watching");
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const newStrong = strong.filter((o) => {
    const t = o.last_filed_at ? new Date(o.last_filed_at).getTime() : 0;
    return t >= sevenDaysAgo;
  });

  const recentNews = (snap.matched_news || []).filter((n) => {
    const t = n.published_at ? new Date(n.published_at).getTime() : 0;
    return t >= sevenDaysAgo;
  });

  const fdic = (snap.fdic_signals || []).filter((s) => {
    const t = s.filed_at ? new Date(s.filed_at).getTime() : 0;
    return t >= sevenDaysAgo;
  });

  const ncua = (snap.ncua_signals || []).filter((s) => {
    const t = s.filed_at ? new Date(s.filed_at).getTime() : 0;
    return t >= sevenDaysAgo;
  });

  // Top 3 most-actionable strong banks for the operator to ping this week.
  const top3 = strong.slice(0, 3).map((o) => {
    const sig = topSignalFor(o.ticker, snap.top_signals);
    return {
      ticker: o.ticker,
      name: o.name,
      label: sig ? plainSignal(sig.signal_type).label : "Filing activity",
      filed: fmtRelDate(o.last_filed_at),
    };
  });

  const cb = snap.cleared_books;
  const mp = snap.market_pricing;

  const subject = `Your week: ${strong.length} strong · ${watching.length} watching${
    mp?.market_median_cents != null ? ` · paper ~${mp.market_median_cents}¢` : ""
  }`;

  const lines: string[] = [
    `Tradeline · weekly operator digest`,
    `Generated ${new Date().toUTCString()}`,
    ``,
    `THIS WEEK'S MOVES`,
    ``,
    `${newStrong.length} new bank${newStrong.length === 1 ? "" : "s"} hit strong-signal in the last 7 days.`,
    `${recentNews.length} fresh news item${recentNews.length === 1 ? "" : "s"} on banks you track.`,
    `${fdic.length + ncua.length} community-bank/credit-union signal${fdic.length + ncua.length === 1 ? "" : "s"} (FDIC + NCUA).`,
    ``,
  ];

  // Market & supply intelligence — pricing benchmark + distressed books that moved.
  if (mp?.market_median_cents != null || (cb && cb.count > 0)) {
    lines.push(`MARKET & SUPPLY`, ``);
    if (mp?.market_median_cents != null) {
      const dir =
        mp.price_direction === "rising"
          ? "rising (buyers paying up — bid competitively)"
          : mp.price_direction === "softening"
            ? "softening (you can bid lower)"
            : "mixed";
      const buyerLine = mp.buyers.map((b) => `${b.ticker} ${b.latest_cents}¢`).join(", ");
      lines.push(`Paper is clearing at ~${mp.market_median_cents}¢ on the dollar — ${dir}.`);
      lines.push(`Public buyers: ${buyerLine}. Anchor your bids to this.`);
    }
    if (cb && cb.count > 0) {
      lines.push(
        `${cb.count} flagged institutions cleared their distressed book (as of ${cb.as_of})${
          cb.flagged_early > 0
            ? ` — ${cb.flagged_early} we'd flagged earlier${cb.median_lead_days ? `, median ${cb.median_lead_days}d lead` : ""}`
            : ""
        }.`
      );
      const t = cb.top[0];
      if (t) lines.push(`Biggest: ${t.originator_name} (${t.state}), noncurrent −${Math.round(t.drop_pct)}%.`);
    }
    lines.push(``);
  }

  lines.push(`TOP 3 OUTREACH PRIORITIES`, ``);

  if (top3.length === 0) {
    lines.push(`No strong-signal banks this week. Use the quiet to expand your seed list at ${siteUrl}/app/banks or rehearse with the AI tutor at ${siteUrl}/app/tutor.`);
  } else {
    top3.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.ticker} — ${b.name}`);
      lines.push(`   Signal: ${b.label}`);
      lines.push(`   Filed: ${b.filed}`);
      lines.push(`   Open: ${siteUrl}/app/banks/${b.ticker}`);
      lines.push(``);
    });
  }

  lines.push(``);
  lines.push(`YOUR ONE MOVE THIS WEEK`);
  lines.push(``);
  lines.push(
    `Open the daily workbase. The outreach queue is pre-drafted with your firm profile. One click per card ships an email — replies land back in this inbox.`
  );
  lines.push(``);
  lines.push(`→ ${siteUrl}/app/today`);
  lines.push(``);
  lines.push(`──`);
  lines.push(`This digest fires every Sunday at 14:00 UTC. Public sources only (SEC + FDIC + NCUA + buyer disclosures + news).`);
  lines.push(`To stop: remove the operator-digest entry from apps/web/vercel.json crons.`);

  const text = lines.join("\n");
  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [notifyTo],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          enabled: true,
          sent: false,
          error: `Resend ${res.status}: ${errText.slice(0, 300)}`,
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { id?: string };
    return NextResponse.json(
      {
        enabled: true,
        sent: true,
        providerMessageId: data.id || "",
        recipient: notifyTo,
        subject,
        stats: {
          newStrong: newStrong.length,
          recentNews: recentNews.length,
          communitySignals: fdic.length + ncua.length,
          totalStrong: strong.length,
          totalWatching: watching.length,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { enabled: true, error: (err as Error).message },
      { status: 502 }
    );
  }
}
