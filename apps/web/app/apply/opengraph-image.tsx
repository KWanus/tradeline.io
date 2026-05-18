import { ImageResponse } from "next/og";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Apply for Tradeline design partner — 5 seats this quarter";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function ApplyOg() {
  return new ImageResponse(
    ogFrame({
      eyebrow: "Apply",
      eyebrowMeta: "Five seats this quarter",
      titleLines: [
        { text: "Apply for" },
        { text: "design partner.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "Seats", value: "5", accent: "#f5a623" },
        { label: "Discount", value: "50%", accent: "#ec4899" },
        { label: "Office hours", value: "wkly", accent: "#fb923c" },
      ],
      slug: "tradeline.io / apply",
    }),
    { ...size }
  );
}
