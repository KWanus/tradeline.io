"use client";

import { useEffect, useState } from "react";
import { readProfile } from "@/lib/buyer-profile";
import { BrokerToday } from "./_broker-today";

/**
 * Hides the buyer Today view and renders BrokerToday when the operator's
 * profile.role === "broker". Pre-hydration we render children so SSR matches
 * the default-buyer case; once hydrated we swap if needed. Brief flash on
 * first paint for brokers is acceptable — alternative is suppressing all
 * content until hydration, which breaks the buyer's snappy load.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<"buyer" | "broker">("buyer");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRole(readProfile().role);
    setHydrated(true);
  }, []);

  if (!hydrated) return <>{children}</>;
  if (role === "broker") return <BrokerToday />;
  return <>{children}</>;
}
