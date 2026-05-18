import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline — bank signal";
export const size = OG_SIZE;
export const contentType = "image/png";

const STATUS_COPY = {
  strong: { label: "Strong", accent: "#ec4899" },
  watching: { label: "Watching", accent: "#f59e0b" },
  quiet: { label: "Quiet", accent: "#797569" },
} as const;

export default async function PublicBankOg({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const o = snap.originators.find((x) => x.ticker === ticker);
  const name = o?.name || ticker;
  const status = o ? statusFor(o) : "quiet";
  const statusCopy = STATUS_COPY[status as keyof typeof STATUS_COPY] || STATUS_COPY.quiet;
  const confidence = o ? o.max_confidence.toFixed(2) : "—";
  const signals = o ? String(o.signals) : "0";
  const news = o ? String(o.news_mentions) : "0";

  // Truncate long bank names so the title still fits.
  const displayName = name.length > 32 ? name.slice(0, 30) + "…" : name;

  return new ImageResponse(
    ogFrame({
      eyebrow: "Bank signal",
      eyebrowMeta: o?.tier ? o.tier.toUpperCase().slice(0, 24) : undefined,
      titleLines: [
        { text: ticker, tone: "gradient" },
        { text: displayName, italic: true, tone: "muted" },
      ],
      stats: [
        { label: "Status", value: statusCopy.label, accent: statusCopy.accent },
        { label: "Conf", value: confidence, accent: "#f5a623" },
        { label: "Signals", value: signals, accent: "#fb923c" },
        { label: "News", value: news, accent: "#b4afa3" },
      ],
      slug: `tradeline.io / banks / ${ticker}`,
    }),
    { ...size }
  );
}
