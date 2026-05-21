import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline · community banks showing credit stress";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function CommunityOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const sigs = snap.fdic_signals || [];
  const states = new Set<string>();
  for (const s of sigs) if (s.state) states.add(s.state);

  return new ImageResponse(
    ogFrame({
      eyebrow: "Community banks",
      eyebrowMeta: "FDIC Call Reports",
      titleLines: [
        { text: "The banks that sell" },
        { text: "first tapes.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Signals", value: String(sigs.length), accent: "#f5a623" },
        { label: "States", value: String(states.size), accent: "#fb923c" },
        { label: "Refresh", value: "6h", accent: "#ec4899" },
      ],
      slug: "tradeline.io / community",
    }),
    { ...size }
  );
}
