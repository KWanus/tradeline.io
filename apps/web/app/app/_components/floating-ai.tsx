"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingAi() {
  const pathname = usePathname() || "";
  // Don't double-up when the user is already on the tutor page.
  if (pathname.startsWith("/app/tutor")) return null;

  return (
    <Link
      href="/app/tutor"
      className="fixed bottom-5 right-5 md:bottom-7 md:right-7 z-40 group inline-flex items-center gap-2.5 px-4 py-3 rounded-full text-[13px] font-medium text-[#1a0c00] shadow-[0_14px_38px_-10px_rgba(236,72,153,0.55),0_0_0_1px_rgba(245,166,35,0.4)] hover:shadow-[0_18px_44px_-8px_rgba(236,72,153,0.7),0_0_0_1px_rgba(245,166,35,0.6)] transition-all hover:-translate-y-0.5"
      style={{ background: "var(--gradient-primary)" }}
      aria-label="Ask Tradeline AI"
    >
      <span className="w-2 h-2 rounded-full bg-[#fff8e8]" />
      <span>Ask Tradeline AI</span>
      <span className="opacity-70 group-hover:opacity-100 transition">✦</span>
    </Link>
  );
}
