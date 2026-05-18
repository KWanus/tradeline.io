import { ImageResponse } from "next/og";
import { OG_SIZE, ogFrame } from "@/app/_components/og-frame";

export const runtime = "nodejs";
export const alt = "Tradeline · feeds and APIs";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function FeedsOg() {
  return new ImageResponse(
    ogFrame({
      eyebrow: "Feeds & APIs",
      eyebrowMeta: "OpenAPI 3.0 · open CORS",
      titleLines: [
        { text: "Tradeline is" },
        { text: "API-first.", italic: true, tone: "gradient" },
      ],
      stats: [
        { label: "JSON APIs", value: "6", accent: "#f5a623" },
        { label: "RSS feeds", value: "2", accent: "#fb923c" },
        { label: "Well-known", value: "3", accent: "#ec4899" },
      ],
      slug: "tradeline.io / feeds",
    }),
    { ...size }
  );
}
