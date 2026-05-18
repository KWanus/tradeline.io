import type { MetadataRoute } from "next";

export const dynamic = "force-static";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/report",
          "/about",
          "/coverage",
          "/news",
          "/signals",
          "/changelog",
          "/apply",
          "/status",
          "/kit",
          "/feeds",
          "/privacy",
          "/terms",
          "/unsubscribe",
        ],
        // The workbase, API routes, and per-recipient unsubscribe links carry
        // tokens and user-specific state — keep them out of search indexes.
        disallow: ["/app/", "/api/", "/unsubscribe?"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
