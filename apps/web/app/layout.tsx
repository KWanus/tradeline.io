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
  title: "Tradeline — institutional intelligence for licensed debt buyers",
  description:
    "Deal radar, portfolio scoring, and compliance signal — built for licensed debt buyers and collection agencies. Pre-launch.",
  metadataBase: new URL("https://tradeline.local"),
  openGraph: {
    title: "Tradeline",
    description:
      "Institutional intelligence for licensed debt buyers. Deal radar. Portfolio pulse. Compliance tracker.",
    type: "website",
  },
  robots: { index: false, follow: false },
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
