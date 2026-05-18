import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline · scored SEC filings across every tracked bank";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function SignalsOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const signals = snap.top_signals?.length || 0;
  const tickers = new Set<string>();
  const forms = new Set<string>();
  for (const s of snap.top_signals || []) {
    if (s.ticker) tickers.add(s.ticker);
    if (s.form_type) forms.add(s.form_type);
  }

  return new ImageResponse(
    ogFrame({
      eyebrow: "SEC signals",
      eyebrowMeta: "From EDGAR + XBRL",
      titleLines: [
        { text: "Scored SEC filings" },
        { text: "on tracked banks.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Signals", value: String(signals), accent: "#f5a623" },
        { label: "Banks", value: String(tickers.size), accent: "#fb923c" },
        { label: "Form types", value: String(forms.size), accent: "#ec4899" },
      ],
      slug: "tradeline.io / signals",
    }),
    { ...size }
  );
}
