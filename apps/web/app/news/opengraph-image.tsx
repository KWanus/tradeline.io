import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline · headlines on every tracked bank";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function NewsOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const headlines = snap.matched_news?.length || 0;
  const tickers = new Set<string>();
  for (const n of snap.matched_news || []) {
    for (const t of n.matched_tickers || []) tickers.add(t);
  }

  return new ImageResponse(
    ogFrame({
      eyebrow: "News",
      titleLines: [
        { text: "Headlines on" },
        { text: "tracked banks.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Headlines", value: String(headlines), accent: "#f5a623" },
        { label: "Banks", value: String(tickers.size), accent: "#fb923c" },
        { label: "Refresh", value: "6h", accent: "#ec4899" },
      ],
      slug: "tradeline.io / news",
    }),
    { ...size }
  );
}
