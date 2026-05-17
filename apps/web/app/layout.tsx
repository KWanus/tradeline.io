import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Tradeline — debt-buyer OS",
  description:
    "Institutional intelligence for licensed debt buyers, brokers, and lenders. 57-bank live SEC radar, AI tutor, tape copilot, compliance tracker. Pre-launch — design partner pricing.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ),
  openGraph: {
    title: "Tradeline — find the deal before it's a deal",
    description:
      "Institutional intelligence for licensed debt buyers, brokers, and lenders. 57-bank live SEC radar + AI tutor.",
    type: "website",
    siteName: "Tradeline",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tradeline — debt-buyer OS",
    description:
      "Find the deal before it's a deal. 57-bank live SEC radar for licensed debt buyers, brokers, and lenders.",
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "Tradeline weekly · Charge-Off Report" },
        { url: "/changelog.xml", title: "Tradeline · Changelog" },
      ],
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
