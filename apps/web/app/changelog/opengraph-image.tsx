import { ImageResponse } from "next/og";
import { CHANGELOG } from "@/lib/changelog-entries";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline changelog — what's shipped";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function ChangelogOg() {
  const releases = CHANGELOG.length;
  const shippedItems = CHANGELOG.reduce((n, e) => n + e.bullets.length, 0);
  const latest = CHANGELOG[0]?.date || "—";

  return new ImageResponse(
    ogFrame({
      eyebrow: "Changelog",
      eyebrowMeta: `Latest · ${latest}`,
      titleLines: [
        { text: "What's" },
        { text: "shipped.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Releases", value: String(releases), accent: "#f5a623" },
        { label: "Items", value: String(shippedItems), accent: "#fb923c" },
      ],
      slug: "tradeline.io / changelog",
    }),
    { ...size }
  );
}
