"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

const PROFILE_KEY = "tradeline.buyer_profile.v1";

function openCommandPalette() {
  // The CommandPalette client component listens to ⌘K. We dispatch a
  // synthetic keydown so any "open palette" button triggers the same path.
  const evt = new KeyboardEvent("keydown", {
    key: "k",
    metaKey: true,
    ctrlKey: false,
    bubbles: true,
  });
  window.dispatchEvent(evt);
}

export function TopBar({ userEmail }: { userEmail?: string }) {
  const [profile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const complete = hydrated && isProfileComplete(profile);
  const initial =
    (profile.yourName || userEmail || "T").trim().charAt(0).toUpperCase() || "T";

  return (
    <header className="hidden md:flex sticky top-0 z-30 items-center gap-3 px-6 py-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-bg)]/85 backdrop-blur-md">
      {/* Search trigger — opens the command palette */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="group flex-1 max-w-xl flex items-center gap-3 px-4 py-2 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)] transition text-left"
        aria-label="Open command palette"
      >
        <span className="text-[color:var(--color-fg-faint)] text-[15px]">⌕</span>
        <span className="flex-1 text-[13px] text-[color:var(--color-fg-faint)] group-hover:text-[color:var(--color-fg-dim)] transition">
          Search banks, deals, brokers, anywhere…
        </span>
        <span className="kbd shrink-0">⌘K</span>
      </button>

      {/* Right cluster: primary action + profile status + user */}
      <div className="flex items-center gap-2">
        <Link
          href="/app/banks"
          className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium text-[color:var(--color-fg)] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-success)] glow" />
          Open radar
        </Link>

        <Link
          href="/app/profile"
          title={complete ? "Profile complete" : "Fill your buyer profile"}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-[12px] transition border ${
            complete
              ? "border-[color:var(--color-success-dim)] text-[color:var(--color-success)] bg-[color:var(--color-success-soft)] hover:opacity-90"
              : "border-[color:var(--color-warn)] text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] hover:opacity-90"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${complete ? "bg-[color:var(--color-success)] glow" : "bg-[color:var(--color-warn)]"}`} />
          {complete ? "Profile" : "Fill profile"}
        </Link>

        <Link
          href="/app/profile"
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)] transition"
        >
          <span className="w-7 h-7 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-[12px] font-semibold text-[#1a0c00]">
            {initial}
          </span>
          <span className="hidden xl:flex flex-col text-left pr-1.5">
            <span className="text-[11px] text-[color:var(--color-fg)] leading-tight">
              {profile.firmName || "Set your firm"}
            </span>
            <span className="text-[10px] text-[color:var(--color-fg-faint)] leading-tight truncate max-w-[12em]">
              {userEmail || profile.email || "set email in profile"}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
