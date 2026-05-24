import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import {
  jsonLdScript,
  organizationLd,
  websiteLd,
} from "@/lib/json-ld";

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
    <html lang="en" data-theme="dark" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var ACK='tradeline.theme.migrated.v3';if(!localStorage.getItem(ACK)){var cur=localStorage.getItem('tradeline.theme.v1');if(cur!=='light'){localStorage.setItem('tradeline.theme.v1','dark');}localStorage.setItem(ACK,'1');}var m=location.search.match(/[?&]theme=([^&]+)/);var forced=m?decodeURIComponent(m[1]):null;if(forced==='reset'){try{localStorage.removeItem('tradeline.theme.v1');}catch(e){}forced='dark';}var t=forced||localStorage.getItem('tradeline.theme.v1');var v=(t==='dark'||t==='light'||t==='tradeline')?t:'dark';document.documentElement.setAttribute('data-theme',v);if(forced){try{localStorage.setItem('tradeline.theme.v1',v);}catch(e){}}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(organizationLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(websiteLd())}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
