"use client";

// Whole-OS export — assemble every operator-policy store + activity log
// + portfolio + pipeline + collections + returns into one structured JSON
// blob. Use cases: backup, sharing with counsel, debugging, migrating to
// a new browser, cold-storage snapshot before a risky change.
//
// Pure read from localStorage (no fetches). Operator-controlled download
// — nothing transmits server-side. Output is a single JSON file with a
// metadata header + nested store payloads.

const KEYS = [
  // Spine policies
  "tradeline.compliance.licenses.v1",
  "tradeline.license.policy.v1",
  "tradeline.capital.config.v1",
  "tradeline.concentration.policy.v1",
  // Workflow stores
  "tradeline.portfolio.holdings.v1",
  "tradeline.pipeline.deals.v1",
  "tradeline.collections.v1",
  "tradeline.returns.v1",
  // Fingerprints + acks
  "tradeline.tape-fingerprints.v1",
  "tradeline.fingerprint.salt.v1",
  "tradeline.urgent-acks.v1",
  "tradeline.rule-changes.acks.v1",
  // Activity log
  "tradeline.activity-log.v1",
  // Profile + setup
  "tradeline.buyer_profile.v1",
  "tradeline.welcome_completed.v1",
  // Briefing + tutor
  "tradeline.briefing.cache.v1",
  "tradeline.briefing.auto-fire-opt-out.v1",
  "tradeline.tutor.messages.v1",
] as const;

type StoreEntry = {
  key: string;
  present: boolean;
  byteSize: number;
  parsed: unknown;
};

export type OperatorStateExport = {
  schemaVersion: "1";
  exportedAt: string; // ISO
  appHostname: string;
  storeCount: number;
  totalBytes: number;
  stores: StoreEntry[];
};

export function buildOperatorStateExport(): OperatorStateExport {
  const stores: StoreEntry[] = [];
  let totalBytes = 0;

  if (typeof window === "undefined") {
    return {
      schemaVersion: "1",
      exportedAt: new Date().toISOString(),
      appHostname: "",
      storeCount: 0,
      totalBytes: 0,
      stores: [],
    };
  }

  for (const key of KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        stores.push({ key, present: false, byteSize: 0, parsed: null });
        continue;
      }
      const byteSize = new Blob([raw]).size;
      totalBytes += byteSize;
      let parsed: unknown = raw;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // leave as raw string when not JSON (e.g., the salt)
      }
      stores.push({ key, present: true, byteSize, parsed });
    } catch {
      stores.push({ key, present: false, byteSize: 0, parsed: null });
    }
  }

  return {
    schemaVersion: "1",
    exportedAt: new Date().toISOString(),
    appHostname: window.location.hostname || "",
    storeCount: stores.filter((s) => s.present).length,
    totalBytes,
    stores,
  };
}

// ---------------------------------------------------------------------------
// Restore — read a previously-exported JSON payload and write its stores
// back to localStorage. SAFE OVERWRITE: returns a preview first so the UI
// can show the operator what will be replaced before they confirm.
// ---------------------------------------------------------------------------

export type RestorePreview = {
  ok: boolean;
  reason?: string;
  payloadExportedAt?: string;
  schemaVersion?: string;
  // Per-store change preview
  toRestore: Array<{
    key: string;
    incomingBytes: number;
    existingBytes: number;
    willOverwriteExisting: boolean;
  }>;
  totalStoresInPayload: number;
  totalBytesInPayload: number;
};

const ALLOWED_KEY_SET = new Set<string>(KEYS);

export function previewRestore(payloadText: string): RestorePreview {
  if (typeof window === "undefined") {
    return {
      ok: false,
      reason: "SSR — restore requires browser",
      toRestore: [],
      totalStoresInPayload: 0,
      totalBytesInPayload: 0,
    };
  }
  let parsed: OperatorStateExport;
  try {
    parsed = JSON.parse(payloadText) as OperatorStateExport;
  } catch (err) {
    return {
      ok: false,
      reason: `Invalid JSON: ${(err as Error).message}`,
      toRestore: [],
      totalStoresInPayload: 0,
      totalBytesInPayload: 0,
    };
  }
  if (parsed?.schemaVersion !== "1") {
    return {
      ok: false,
      reason: `Unsupported schemaVersion '${parsed?.schemaVersion ?? "(missing)"}'. This restore expects schemaVersion '1'.`,
      toRestore: [],
      totalStoresInPayload: 0,
      totalBytesInPayload: 0,
    };
  }
  if (!Array.isArray(parsed.stores)) {
    return {
      ok: false,
      reason: "Payload missing 'stores' array.",
      toRestore: [],
      totalStoresInPayload: 0,
      totalBytesInPayload: 0,
    };
  }

  const preview: RestorePreview["toRestore"] = [];
  let totalBytes = 0;
  for (const entry of parsed.stores) {
    if (!entry.present) continue;
    if (!ALLOWED_KEY_SET.has(entry.key)) continue; // skip unknown keys defensively
    const incomingSerialized =
      typeof entry.parsed === "string"
        ? entry.parsed
        : JSON.stringify(entry.parsed);
    const incomingBytes = new Blob([incomingSerialized]).size;
    const existing = window.localStorage.getItem(entry.key);
    const existingBytes = existing ? new Blob([existing]).size : 0;
    preview.push({
      key: entry.key,
      incomingBytes,
      existingBytes,
      willOverwriteExisting: existing !== null,
    });
    totalBytes += incomingBytes;
  }

  return {
    ok: true,
    payloadExportedAt: parsed.exportedAt,
    schemaVersion: parsed.schemaVersion,
    toRestore: preview,
    totalStoresInPayload: preview.length,
    totalBytesInPayload: totalBytes,
  };
}

export function applyRestore(payloadText: string): {
  ok: boolean;
  reason?: string;
  restoredCount: number;
  skippedCount: number;
} {
  if (typeof window === "undefined") {
    return { ok: false, reason: "SSR", restoredCount: 0, skippedCount: 0 };
  }
  let parsed: OperatorStateExport;
  try {
    parsed = JSON.parse(payloadText) as OperatorStateExport;
  } catch (err) {
    return {
      ok: false,
      reason: `Invalid JSON: ${(err as Error).message}`,
      restoredCount: 0,
      skippedCount: 0,
    };
  }
  if (parsed?.schemaVersion !== "1" || !Array.isArray(parsed.stores)) {
    return {
      ok: false,
      reason: "Unsupported schema or missing stores",
      restoredCount: 0,
      skippedCount: 0,
    };
  }

  let restored = 0;
  let skipped = 0;
  for (const entry of parsed.stores) {
    if (!entry.present) {
      skipped++;
      continue;
    }
    if (!ALLOWED_KEY_SET.has(entry.key)) {
      skipped++;
      continue;
    }
    try {
      const value =
        typeof entry.parsed === "string"
          ? entry.parsed
          : JSON.stringify(entry.parsed);
      window.localStorage.setItem(entry.key, value);
      restored++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, restoredCount: restored, skippedCount: skipped };
}

// ---------------------------------------------------------------------------
// Markdown digest — sanitized human-readable snapshot of current OS state.
// Counts + totals only; no names, addresses, SSNs, account numbers, or
// row-level data. Operator can paste into a chat LLM for an outside
// opinion, forward to counsel/accountant for context, or snapshot before
// a big decision.
// ---------------------------------------------------------------------------

type Licenseish = {
  state?: string;
  licenseType?: string;
  expirationDate?: string;
};
type Holdingish = {
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  assetClass?: string;
};
type Dealish = {
  stage?: string;
  faceValueUsd?: number;
};
type Returnish = {
  status?: string;
  refundExpectedUsd?: number;
};
type Activityish = {
  ts?: string;
  type?: string;
  pillar?: string;
  meta?: { totalFaceValueUsd?: number | string };
};

function safeArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeObj<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function daysUntilSafe(iso?: string): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((t - Date.now()) / 86_400_000);
}

export function buildOperatorStateDigest(): string {
  const exportedAt = new Date().toISOString().slice(0, 10);
  const hostname =
    typeof window !== "undefined" ? window.location.hostname || "local" : "local";

  const licenses = safeArr<Licenseish>("tradeline.compliance.licenses.v1");
  const activeLicenses = licenses.filter((l) => daysUntilSafe(l.expirationDate) >= 0);
  const expiredLicenses = licenses.filter((l) => daysUntilSafe(l.expirationDate) < 0);
  const expiringSoon = activeLicenses.filter((l) => daysUntilSafe(l.expirationDate) <= 30);
  const activeStates = Array.from(
    new Set(activeLicenses.map((l) => (l.state ?? "").toUpperCase()).filter(Boolean))
  ).sort();

  const capital = safeObj<{
    configured?: boolean;
    total?: number;
    deployed?: number;
    committed?: number;
    available?: number;
  }>("tradeline.capital.config.v1");

  const concentration = safeObj<{
    configured?: boolean;
    limits?: Record<string, number>;
  }>("tradeline.concentration.policy.v1");

  const holdings = safeArr<Holdingish>("tradeline.portfolio.holdings.v1");
  const holdingsFace = holdings.reduce((s, h) => s + (Number(h.faceValueUsd) || 0), 0);
  const holdingsCost = holdings.reduce((s, h) => s + (Number(h.purchasePriceUsd) || 0), 0);
  const holdingsByClass = new Map<string, number>();
  for (const h of holdings) {
    const cls = String(h.assetClass ?? "unknown");
    holdingsByClass.set(cls, (holdingsByClass.get(cls) ?? 0) + (Number(h.faceValueUsd) || 0));
  }

  const deals = safeArr<Dealish>("tradeline.pipeline.deals.v1");
  const dealsByStage = new Map<string, { count: number; face: number }>();
  for (const d of deals) {
    const stage = String(d.stage ?? "unknown");
    const cur = dealsByStage.get(stage) ?? { count: 0, face: 0 };
    cur.count++;
    cur.face += Number(d.faceValueUsd) || 0;
    dealsByStage.set(stage, cur);
  }

  const returns = safeArr<Returnish>("tradeline.returns.v1");
  const returnsByStatus = new Map<string, number>();
  let refundTracked = 0;
  for (const r of returns) {
    const s = String(r.status ?? "open");
    returnsByStatus.set(s, (returnsByStatus.get(s) ?? 0) + 1);
    refundTracked += Number(r.refundExpectedUsd) || 0;
  }

  const log = safeArr<Activityish>("tradeline.activity-log.v1");
  const weekCutoff = Date.now() - 7 * 86_400_000;
  const weekLog = log.filter((e) => {
    const t = e.ts ? new Date(e.ts).getTime() : 0;
    return t >= weekCutoff;
  });
  const weekDecodes = weekLog.filter((e) => e.type === "tape_decoded");
  const weekDecodedFace = weekDecodes.reduce(
    (s, e) => s + (Number(e.meta?.totalFaceValueUsd) || 0),
    0
  );
  const weekPipelineMoves = weekLog.filter((e) => e.pillar === "pipeline").length;
  const weekConversions = weekLog.filter(
    (e) => e.type === "deal_converted_to_holding"
  ).length;
  const weekCompliance = weekLog.filter((e) => e.pillar === "compliance").length;
  const weekCapital = weekLog.filter((e) => e.pillar === "capital").length;
  const weekReturns = weekLog.filter((e) => e.pillar === "returns").length;

  const lines: string[] = [];
  lines.push(`# Tradeline OS digest — ${exportedAt}`);
  lines.push(`Exported from ${hostname}. Counts + totals only — no PII.`);
  lines.push("");
  lines.push("## Compliance");
  if (licenses.length === 0) {
    lines.push("- No licenses configured.");
  } else {
    lines.push(
      `- ${activeLicenses.length} active license${activeLicenses.length === 1 ? "" : "s"}${activeStates.length > 0 ? ` (${activeStates.join(", ")})` : ""}`
    );
    if (expiringSoon.length > 0) {
      lines.push(`- ${expiringSoon.length} expiring within 30 days`);
    }
    if (expiredLicenses.length > 0) {
      lines.push(`- ${expiredLicenses.length} expired (renewal blocking ${expiredLicenses.length} state${expiredLicenses.length === 1 ? "" : "s"})`);
    }
  }
  lines.push("");
  lines.push("## Capital");
  if (!capital?.configured) {
    lines.push("- Not configured.");
  } else {
    lines.push(`- Total: ${fmtUsd(capital.total ?? 0)}`);
    lines.push(`- Deployed: ${fmtUsd(capital.deployed ?? 0)}`);
    lines.push(`- Committed (live bids): ${fmtUsd(capital.committed ?? 0)}`);
    lines.push(`- Available: ${fmtUsd(capital.available ?? 0)}`);
  }
  lines.push("");
  lines.push("## Concentration policy");
  if (!concentration?.configured || !concentration.limits) {
    lines.push("- Not configured.");
  } else {
    const entries = Object.entries(concentration.limits);
    if (entries.length === 0) {
      lines.push("- No limits set.");
    } else {
      for (const [dim, pct] of entries) {
        lines.push(`- ${dim}: ${pct}%`);
      }
    }
  }
  lines.push("");
  lines.push("## Portfolio");
  if (holdings.length === 0) {
    lines.push("- No holdings.");
  } else {
    lines.push(`- ${holdings.length} holding${holdings.length === 1 ? "" : "s"} · ${fmtUsd(holdingsFace)} face · ${fmtUsd(holdingsCost)} cost basis`);
    if (holdingsByClass.size > 0) {
      const byClass = Array.from(holdingsByClass.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cls, face]) => {
          const pct = holdingsFace > 0 ? Math.round((face / holdingsFace) * 100) : 0;
          return `${cls} ${pct}%`;
        })
        .join(" · ");
      lines.push(`- Mix: ${byClass}`);
    }
  }
  lines.push("");
  lines.push("## Pipeline");
  if (deals.length === 0) {
    lines.push("- No deals.");
  } else {
    const totalFace = Array.from(dealsByStage.values()).reduce((s, v) => s + v.face, 0);
    for (const [stage, v] of Array.from(dealsByStage.entries()).sort()) {
      lines.push(`- ${stage}: ${v.count} · ${fmtUsd(v.face)} face`);
    }
    lines.push(`- Total face in pipeline: ${fmtUsd(totalFace)}`);
  }
  lines.push("");
  lines.push("## Returns");
  if (returns.length === 0) {
    lines.push("- No returns tracked.");
  } else {
    const statusLine = Array.from(returnsByStatus.entries())
      .map(([s, n]) => `${s}: ${n}`)
      .join(" · ");
    lines.push(`- ${statusLine}`);
    if (refundTracked > 0) {
      lines.push(`- Refund tracked: ${fmtUsd(refundTracked)}`);
    }
  }
  lines.push("");
  lines.push("## Activity (last 7 days)");
  if (weekLog.length === 0) {
    lines.push("- No activity logged this week.");
  } else {
    lines.push(`- ${weekLog.length} action${weekLog.length === 1 ? "" : "s"} total`);
    if (weekDecodes.length > 0) {
      lines.push(`- ${weekDecodes.length} tape decode${weekDecodes.length === 1 ? "" : "s"} (${fmtUsd(weekDecodedFace)} face evaluated)`);
    }
    if (weekPipelineMoves > 0) {
      lines.push(`- ${weekPipelineMoves} pipeline move${weekPipelineMoves === 1 ? "" : "s"}`);
    }
    if (weekConversions > 0) {
      lines.push(`- ${weekConversions} won → held conversion${weekConversions === 1 ? "" : "s"}`);
    }
    if (weekCompliance > 0) lines.push(`- ${weekCompliance} compliance edit${weekCompliance === 1 ? "" : "s"}`);
    if (weekCapital > 0) lines.push(`- ${weekCapital} capital edit${weekCapital === 1 ? "" : "s"}`);
    if (weekReturns > 0) lines.push(`- ${weekReturns} returns action${weekReturns === 1 ? "" : "s"}`);
  }
  lines.push("");
  lines.push("## Sanitization note");
  lines.push(
    "This digest contains counts, totals, and policy values only. No borrower names, addresses, SSNs, account numbers, originator names, or tape row data are included. Safe to paste into a general-purpose chat LLM or forward to non-technical advisors."
  );
  lines.push("");

  return lines.join("\n");
}

export function downloadOperatorStateDigest(): { ok: boolean; bytes: number } {
  if (typeof window === "undefined") return { ok: false, bytes: 0 };
  try {
    const md = buildOperatorStateDigest();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `tradeline-os-digest-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, bytes: blob.size };
  } catch {
    return { ok: false, bytes: 0 };
  }
}

export function downloadOperatorStateExport(): { ok: boolean; bytes: number } {
  if (typeof window === "undefined") return { ok: false, bytes: 0 };
  try {
    const payload = buildOperatorStateExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `tradeline-operator-state-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, bytes: blob.size };
  } catch {
    return { ok: false, bytes: 0 };
  }
}
