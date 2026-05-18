import type { MetadataRoute } from "next";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-static";
export const revalidate = 3600;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  // Per-bank public pages — one URL per tracked originator. Read at build
  // time (cached for `revalidate` seconds, so the sitemap refreshes within
  // an hour of any new bank being added).
  let bankEntries: MetadataRoute.Sitemap = [];
  try {
    const snap = await readSnapshot();
    bankEntries = (snap.originators || []).map((o) => ({
      url: `${base}/banks/${o.ticker}`,
      lastModified: o.last_filed_at ? new Date(o.last_filed_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch {
    // If the snapshot is unavailable, ship the core sitemap without bank
    // entries — better than failing the whole sitemap.
  }

  // Only public-facing surfaces go in the sitemap. /app/* is the operator
  // workbase — gated by localStorage in this phase but conceptually private,
  // so we keep it out of search indexes.
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/report`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/coverage`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/apply`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/status`,
      lastModified: now,
      changeFrequency: "always",
      priority: 0.4,
    },
    {
      url: `${base}/changelog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${base}/kit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/feeds`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...bankEntries,
  ];
}
