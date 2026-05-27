"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import { NotificationBell } from "./notification-bell";
import { SpineStateBadge } from "./spine-state-badge";
import { ThemeSwitcher } from "./theme-switcher";

const PROFILE_KEY = "tradeline.buyer_profile.v1";

type AutopilotSummary = {
  enabled: boolean;
  dryRun: boolean;
  pausedReason: string | null;
  dailyCap: number;
};

function autopilotPillFor(ap: AutopilotSummary) {
  if (ap.pausedReason) {
    return {
      classes:
        "bg-[color:var(--color-warn-soft)] border-[color:var(--color-warn)] text-[color:var(--color-warn)]",
      dot: "bg-[color:var(--color-warn)]",
      label: "paused",
      title: `Autopilot paused — ${ap.pausedReason}`,
    };
  }
  if (!ap.enabled) {
    return {
      classes:
        "bg-[color:var(--color-bg-1)] border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]",
      dot: "bg-[color:var(--color-fg-faint)]",
      label: "off",
      title: "Autopilot is off — click to configure",
    };
  }
  if (ap.dryRun) {
    return {
      classes:
        "bg-[color:var(--color-accent-soft)] border-[color:var(--color-line-strong)] text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]",
      dot: "bg-[color:var(--color-accent)] glow",
      label: "dry-run",
      title: `Autopilot armed in dry-run mode (cap ${ap.dailyCap}/day)`,
    };
  }
  return {
    classes:
      "bg-[color:var(--color-success-soft)] border-[color:var(--color-success-dim)] text-[color:var(--color-success)] hover:border-[color:var(--color-success)]",
    dot: "bg-[color:var(--color-success)] glow",
    label: "live",
    title: `Autopilot live (cap ${ap.dailyCap}/day)`,
  };
}

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

export function TopBar({
  userEmail,
  autopilot,
}: {
  userEmail?: string;
  autopilot?: AutopilotSummary;
}) {
  const [profile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const complete = hydrated && isProfileComplete(profile);
  const initial =
    (profile.yourName || userEmail || "T").trim().charAt(0).toUpperCase() || "T";

  return (
    <>
      {/* Mobile — compact bar above the MobileTabs nav */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-4 py-2.5 border-b border-[color:var(--color-line)] bg-[color:var(--color-bg)]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#0a0c14] font-bold text-[14px] shadow-[0_6px_18px_-6px_rgba(var(--tint-accent-rgb),0.55)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] text-left"
          aria-label="Search"
        >
          <span className="text-[color:var(--color-fg-faint)] text-[14px]">⌕</span>
          <span className="text-[12px] text-[color:var(--color-fg-faint)] truncate">
            Search…
          </span>
        </button>
        {/* Mobile mount of the notification bell — desktop has it in the
            sidebar's logo row; mobile users only see this. */}
        <div className="shrink-0">
          <NotificationBell />
        </div>
        <Link
          href="/app/profile"
          title={complete ? "Profile complete" : "Profile incomplete"}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] relative"
        >
          <span className="font-mono text-[12px] font-semibold text-[#0a0c14]">
            <span
              className="absolute inset-0 m-1 rounded-full flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              {initial}
            </span>
          </span>
          <span
            aria-hidden
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[color:var(--color-bg)] ${
              complete ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-warn)]"
            }`}
          />
        </Link>
      </header>

      {/* Desktop — full bar */}
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

      {/* Right cluster: theme + primary action + profile status + user */}
      <div className="flex items-center gap-2">
        <div className="hidden md:block">
          <ThemeSwitcher />
        </div>
        <SpineStateBadge />
        {autopilot &&
          (() => {
            const pill = autopilotPillFor(autopilot);
            return (
              <Link
                href="/app/autopilot"
                title={pill.title}
                className={`hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition ${pill.classes}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                <span>Autopilot · {pill.label}</span>
              </Link>
            );
          })()}

        <Link
          href="/app/banks"
          className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold text-[#0a0c14] shadow-[0_8px_22px_-6px_rgba(var(--tint-accent-rgb),0.55)] hover:shadow-[0_12px_28px_-4px_rgba(var(--tint-accent-rgb),0.75)] hover:-translate-y-0.5 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          <span className="text-[14px] leading-none">+</span>
          Scan banks
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
          <span className="w-7 h-7 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-[12px] font-semibold text-[#0a0c14]">
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
    </>
  );
}
