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
