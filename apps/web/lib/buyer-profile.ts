"use client";

import { useEffect, useState } from "react";

export type BuyerProfile = {
  yourName: string;
  firmName: string;
  state: string;
  licenseNumber: string;
  bondCarrier: string;
  bondAmount: string;
  servicer: string;
  ticketRange: string;
  assetFocus: string;
  phone: string;
  email: string;
};

export const EMPTY_PROFILE: BuyerProfile = {
  yourName: "",
  firmName: "",
  state: "",
  licenseNumber: "",
  bondCarrier: "",
  bondAmount: "",
  servicer: "",
  ticketRange: "",
  assetFocus: "",
  phone: "",
  email: "",
};

export const PROFILE_KEY = "tradeline.buyer_profile.v1";

const PROFILE_EVENT = "tradeline.buyer_profile.changed";

export function isProfileComplete(p: BuyerProfile): boolean {
  return Boolean(
    p.yourName.trim() &&
      p.firmName.trim() &&
      p.state.trim() &&
      p.assetFocus.trim()
  );
}

export function readProfile(): BuyerProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function writeProfile(p: BuyerProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT));
  } catch {}
}

export function useBuyerProfile(): [BuyerProfile, (p: BuyerProfile) => void] {
  const [profile, setProfile] = useState<BuyerProfile>(EMPTY_PROFILE);

  useEffect(() => {
    setProfile(readProfile());

    const onChange = () => setProfile(readProfile());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_KEY) setProfile(readProfile());
    };
    window.addEventListener(PROFILE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const save = (p: BuyerProfile) => {
    setProfile(p);
    writeProfile(p);
  };

  return [profile, save];
}

export type FillContext = {
  ticker?: string;
  bankName?: string;
  signalLabel?: string;
  yoyPct?: number;
};

const PROFILE_TOKENS: Record<keyof BuyerProfile, string> = {
  yourName: "[YOUR_NAME]",
  firmName: "[FIRM]",
  state: "[STATE]",
  licenseNumber: "[LICENSE]",
  bondCarrier: "[BOND_CARRIER]",
  bondAmount: "[BOND_AMOUNT]",
  servicer: "[SERVICER]",
  ticketRange: "[TICKET]",
  assetFocus: "[ASSET_FOCUS]",
  phone: "[PHONE]",
  email: "[EMAIL]",
};

const PROFILE_PLACEHOLDERS: Record<keyof BuyerProfile, string> = {
  yourName: "[Your name]",
  firmName: "[Your firm]",
  state: "[State]",
  licenseNumber: "[License #]",
  bondCarrier: "[Bond carrier]",
  bondAmount: "[Bond amount]",
  servicer: "[Your servicer]",
  ticketRange: "[Your typical ticket]",
  assetFocus: "[Your asset focus]",
  phone: "[Your phone]",
  email: "[Your email]",
};

export function fillTemplate(
  template: string,
  profile: BuyerProfile,
  ctx: FillContext = {}
): string {
  let out = template;

  // Profile tokens (both canonical [TOKEN] and friendlier [your X] forms).
  (Object.keys(PROFILE_TOKENS) as Array<keyof BuyerProfile>).forEach((k) => {
    const value = profile[k] || PROFILE_PLACEHOLDERS[k];
    out = out.replaceAll(PROFILE_TOKENS[k], value);
  });

  // Friendly inline forms used in Playbook + scripts: [your name], [your firm], etc.
  const friendly: Record<string, string> = {
    "[your name]": profile.yourName || "[your name]",
    "[your firm]": profile.firmName || "[your firm]",
    "[state]": profile.state || "[state]",
    "[license #]": profile.licenseNumber || "[license #]",
    "[bond carrier]": profile.bondCarrier || "[bond carrier]",
    "[bond amount]": profile.bondAmount || "[bond amount]",
    "[servicer name]": profile.servicer || "[servicer name]",
    "[asset class]": profile.assetFocus || "[asset class]",
    "[asset class focus]": profile.assetFocus || "[asset class focus]",
    "[range — be honest]": profile.ticketRange || "[range]",
    "[X]": profile.ticketRange || "[X]",
    "[face value cap]": profile.ticketRange || "[face value cap]",
  };
  for (const [k, v] of Object.entries(friendly)) {
    out = out.replaceAll(k, v);
  }

  // Context tokens (bank, signal, etc.)
  if (ctx.bankName) out = out.replaceAll("[BANK]", ctx.bankName);
  if (ctx.ticker) out = out.replaceAll("[TICKER]", ctx.ticker);
  if (ctx.signalLabel) out = out.replaceAll("[SIGNAL]", ctx.signalLabel.toLowerCase());
  if (typeof ctx.yoyPct === "number") {
    out = out.replaceAll("[YOY]", `+${Math.round(ctx.yoyPct)}% year-over-year`);
  } else {
    out = out.replaceAll("[YOY]", "trending up");
  }

  return out;
}

export function buildBuyerProfileSheet(p: BuyerProfile): string {
  return `BUYER PROFILE — ${p.firmName || "[Your firm]"}

Entity:        ${p.firmName || "[Firm name]"}
Principal:     ${p.yourName || "[Your name]"}
License:       ${p.state || "[State]"} debt-buyer license ${p.licenseNumber || "[#]"}
Bond:          ${p.bondCarrier || "[Carrier]"} surety at ${p.bondAmount || "[Amount]"}
Servicer:      ${p.servicer || "[Servicer name]"}
Asset focus:   ${p.assetFocus || "[Asset class focus]"}
Avg ticket:    ${p.ticketRange || "[Range]"}
Contact:       ${p.phone || "[Phone]"} · ${p.email || "[Email]"}

Closing posture: wire on contract execution. Standard buybacks (BK, deceased, SCRA, disputes). 30-day inspection on random sample.

References available on request.`;
}

export function profileSystemContext(p: BuyerProfile): string {
  if (!isProfileComplete(p)) {
    return "The user has not yet filled in their buyer profile. If they ask a question that would benefit from knowing their firm name, state, license, servicer, or ticket size, suggest they fill in their profile at /app/profile.";
  }
  return [
    "The user has the following buyer profile saved locally — use these details to personalize answers, draft emails, and reference their actual situation. If they ask you to draft an email or script, fill these in directly rather than leaving placeholders.",
    "",
    `Name: ${p.yourName}`,
    `Firm: ${p.firmName}`,
    `Licensed state: ${p.state}${p.licenseNumber ? ` (license ${p.licenseNumber})` : ""}`,
    p.bondCarrier && `Bond: ${p.bondCarrier} at ${p.bondAmount || "[amount not set]"}`,
    p.servicer && `Servicer: ${p.servicer}`,
    p.assetFocus && `Asset focus: ${p.assetFocus}`,
    p.ticketRange && `Typical ticket: ${p.ticketRange}`,
    p.phone && `Phone: ${p.phone}`,
    p.email && `Email: ${p.email}`,
  ]
    .filter(Boolean)
    .join("\n");
}
