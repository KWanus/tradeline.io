import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
