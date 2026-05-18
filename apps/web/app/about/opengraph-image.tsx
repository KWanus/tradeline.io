import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "About Tradeline — public-source NPL intelligence";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function AboutOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const banks = snap.originators.length || 57;
  const signals = snap.summary?.sec_signals_total || 0;
  const filings = snap.summary?.filings_total || 0;

  return new ImageResponse(
    ogFrame({
      eyebrow: "About",
      titleLines: [
        { text: "Find the deal" },
        { text: "before it's a deal.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Banks scored", value: String(banks), accent: "#f5a623" },
        { label: "Signals", value: signals.toLocaleString(), accent: "#fb923c" },
        { label: "Filings", value: filings.toLocaleString(), accent: "#ec4899" },
      ],
      slug: "tradeline.io / about",
    }),
    { ...size }
  );
}
