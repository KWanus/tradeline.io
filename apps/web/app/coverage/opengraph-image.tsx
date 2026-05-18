import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline coverage — every bank we track";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function CoverageOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const banks = snap.originators.length || 57;
  const strong = snap.originators.filter((o) => statusFor(o) === "strong").length;
  const watching = snap.originators.filter((o) => statusFor(o) === "watching").length;

  return new ImageResponse(
    ogFrame({
      eyebrow: "Coverage",
      titleLines: [
        { text: `The ${banks} US banks` },
        { text: "Tradeline tracks.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Tracked", value: String(banks), accent: "#f5a623" },
        { label: "Strong", value: String(strong), accent: "#ec4899" },
        { label: "Watching", value: String(watching), accent: "#fb923c" },
      ],
      slug: "tradeline.io / coverage",
    }),
    { ...size }
  );
}
