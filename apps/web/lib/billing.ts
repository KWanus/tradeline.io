"use client";

import { useEffect, useState } from "react";

export type Tier = "starter" | "pro" | "team" | "enterprise" | "fund_of_funds";

export const TIER_INFO: Record<
  Tier,
  { label: string; price: number; audience: string }
> = {
  starter: { label: "Starter", price: 99, audience: "Solo broker, single asset class" },
  pro: { label: "Pro", price: 499, audience: "Multi-broker firm, 2–3 seats" },
  team: { label: "Team", price: 1499, audience: "Small lender / law firm" },
  enterprise: { label: "Enterprise", price: 4999, audience: "National broker" },
  fund_of_funds: { label: "Fund of funds", price: 9999, audience: "Multi-strategy allocator" },
};

export const TIER_ORDER: Tier[] = [
  "starter",
  "pro",
  "team",
  "enterprise",
  "fund_of_funds",
];

/** Map customer-side or subscriber-side plan names to billing tiers. */
export function planToTier(plan: string): Tier | null {
  switch (plan) {
    case "trial":
    case "solo":
    case "starter":
      return "starter";
    case "pro":
      return "pro";
    case "team":
      return "team";
    case "enterprise":
      return "enterprise";
    case "fund-of-funds":
    case "fund_of_funds":
      return "fund_of_funds";
    default:
      return null;
  }
}

export type PaymentLinks = Partial<Record<Tier, string>>;

const STORAGE_KEY = "tradeline.payment_links.v1";
const EVENT = "tradeline.payment_links.changed";

function isValidStripeLink(url: string): boolean {
  if (!url) return false;
  return /^https:\/\/(buy\.stripe\.com|pay\.[\w-]+)\/[\w-]+/i.test(url.trim());
}

export function readPaymentLinks(): PaymentLinks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function writePaymentLinks(links: PaymentLinks): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {}
}

export function usePaymentLinks(): [
  PaymentLinks,
  (tier: Tier, url: string) => void,
  (tier: Tier) => void,
] {
  const [links, setLinks] = useState<PaymentLinks>({});

  useEffect(() => {
    setLinks(readPaymentLinks());
    const onChange = () => setLinks(readPaymentLinks());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLinks(readPaymentLinks());
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLink = (tier: Tier, url: string) => {
    const trimmed = url.trim();
    const next = { ...links };
    if (trimmed) next[tier] = trimmed;
    else delete next[tier];
    setLinks(next);
    writePaymentLinks(next);
  };

  const remove = (tier: Tier) => {
    const next = { ...links };
    delete next[tier];
    setLinks(next);
    writePaymentLinks(next);
  };

  return [links, setLink, remove];
}

export { isValidStripeLink };
