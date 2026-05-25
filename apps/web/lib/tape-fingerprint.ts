// Cross-tape double-sold detection — V3 moat ingredient #2.
//
// When an operator decodes multiple tapes over time, the highest-value
// unflagged risk in the secondary market is "I'm about to pay for accounts
// already on a portfolio I bought last month." This module fingerprints
// every decoded tape (per-account hashes, NO PII stored) and on each new
// decode checks whether any of the new tape's accounts match a previously
// seen tape.
//
// Privacy posture (load-bearing): raw account numbers, DOB, balances are
// hashed at decode time using a per-installation salt and discarded. Only
// the hashes are persisted — they can't be reversed to PII without the
// salt, and the salt never leaves the browser. The export downstream (in
// the UI consumer) only references row indices in the operator's own tape,
// not the hash values themselves.
//
// V1 storage: localStorage with FIFO eviction at 100k total hashes across
// all saved fingerprints. V2 will swap the hash array for a Bloom filter
// (lower memory, fixed size) and add federated cross-operator matching.

// Records are typed loosely as Record<string, string> rather than importing
// from the canonical-schema module — keeps this module decoupled.

// ---------------------------------------------------------------------------
// Install salt — random per-browser, generated on first use, stable after
// ---------------------------------------------------------------------------

const SALT_KEY = "tradeline.fingerprint.salt.v1";

export function getOrCreateInstallSalt(): string {
  if (typeof window === "undefined") return "ssr-stub-salt";
  try {
    const existing = window.localStorage.getItem(SALT_KEY);
    if (existing && existing.length >= 16) return existing;
    // Generate 32-byte random salt, base64-encoded
    const buf = new Uint8Array(32);
    window.crypto.getRandomValues(buf);
    const salt = btoa(String.fromCharCode(...buf));
    window.localStorage.setItem(SALT_KEY, salt);
    return salt;
  } catch {
    return "fallback-salt-non-secure";
  }
}

// ---------------------------------------------------------------------------
// Hashing — uses Web Crypto SHA-256 (async). Per-account hash combines
// salt + canonicalized identifiers so a slightly different format on the
// same account produces the same hash.
// ---------------------------------------------------------------------------

function canonicalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toString().trim().toLowerCase().replace(/\s+/g, "").replace(/[-_/\\.]+/g, "");
}

function canonicalizeAccountNumber(s: string | null | undefined): string {
  if (!s) return "";
  // Strip all non-alphanumerics. Many sellers mask middle digits, so we
  // match on the visible-digit pattern itself.
  return s.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function canonicalizeBalance(n: number): string {
  if (!Number.isFinite(n)) return "";
  // Round to nearest dollar to absorb cent-level drift between tapes
  return String(Math.round(n));
}

function canonicalizeDate(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.toString().trim();
  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const iso = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // US: MM/DD/YYYY
  const us = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    let yr = Number(us[3]);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    return `${yr}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return canonicalize(t);
}

export type FingerprintInput = {
  accountNumber?: string;
  dob?: string;
  balance?: number; // canonical balance (charge-off or current)
  originator?: string;
  openDate?: string;
  ssnLast4?: string;
};

async function sha256Hex(text: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // SSR fallback — should never run; we only fingerprint in the browser
    return text;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuf = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAccount(input: FingerprintInput, salt: string): Promise<string> {
  // Multi-token combine — order matters; format is fixed so two tapes
  // describing the same account produce the same hash even if the seller
  // changed naming conventions between sales.
  const parts = [
    "v1",
    salt,
    canonicalizeAccountNumber(input.accountNumber),
    canonicalizeDate(input.dob),
    canonicalize(input.ssnLast4),
    canonicalize(input.originator),
    canonicalizeBalance(input.balance ?? NaN),
    canonicalizeDate(input.openDate),
  ];
  return sha256Hex(parts.join("|"));
}

// ---------------------------------------------------------------------------
// Tape-level fingerprint persistence
// ---------------------------------------------------------------------------

export const FINGERPRINT_STORAGE_KEY = "tradeline.tape-fingerprints.v1";
export const MAX_HASHES_TOTAL = 100_000;

export type StoredTapeFingerprint = {
  tapeId: string; // uuid generated at save time
  fileName: string;
  createdAt: string; // ISO
  accountCount: number; // total rows in tape
  hashCount: number; // length of hashes (may be < accountCount if some rows had no fingerprint inputs)
  totalFaceValue: number; // for ops display
  hashes: string[]; // SHA-256 hex strings
};

export type FingerprintStore = {
  tapes: StoredTapeFingerprint[];
};

function emptyStore(): FingerprintStore {
  return { tapes: [] };
}

export function readFingerprintStore(): FingerprintStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(FINGERPRINT_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as FingerprintStore).tapes)) {
      return parsed as FingerprintStore;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}

function writeFingerprintStore(store: FingerprintStore): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(FINGERPRINT_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// Save a fingerprint. Enforces total-hash cap via FIFO eviction. Returns
// metadata about what was stored (and whether eviction happened).
export type SaveResult = {
  ok: boolean;
  storedTapeId: string;
  evictedTapeIds: string[];
  totalHashesAfter: number;
};

export function saveTapeFingerprint(input: {
  fileName: string;
  hashes: string[];
  accountCount: number;
  totalFaceValue: number;
}): SaveResult {
  const store = readFingerprintStore();
  const tapeId = generateTapeId();
  const entry: StoredTapeFingerprint = {
    tapeId,
    fileName: input.fileName,
    createdAt: new Date().toISOString(),
    accountCount: input.accountCount,
    hashCount: input.hashes.length,
    totalFaceValue: input.totalFaceValue,
    hashes: input.hashes,
  };
  store.tapes.unshift(entry); // newest first

  // FIFO evict oldest until total hashes ≤ cap
  const evicted: string[] = [];
  let totalHashes = store.tapes.reduce((s, t) => s + t.hashCount, 0);
  while (totalHashes > MAX_HASHES_TOTAL && store.tapes.length > 1) {
    const oldest = store.tapes.pop();
    if (!oldest) break;
    totalHashes -= oldest.hashCount;
    evicted.push(oldest.tapeId);
  }
  const ok = writeFingerprintStore(store);
  return { ok, storedTapeId: tapeId, evictedTapeIds: evicted, totalHashesAfter: totalHashes };
}

export function clearAllFingerprints(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(FINGERPRINT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function deleteTapeFingerprint(tapeId: string): boolean {
  const store = readFingerprintStore();
  const next = store.tapes.filter((t) => t.tapeId !== tapeId);
  if (next.length === store.tapes.length) return false;
  return writeFingerprintStore({ tapes: next });
}

function generateTapeId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Cross-tape match check
// ---------------------------------------------------------------------------

export type DoubleSoldMatch = {
  priorTapeId: string;
  priorTapeFileName: string;
  priorTapeCreatedAt: string;
  matchedHashCount: number;
  // Best estimate of overlap as % of new tape's hashes
  overlapPctOfNew: number;
  // Best estimate of overlap as % of prior tape's hashes
  overlapPctOfPrior: number;
};

export type DoubleSoldReport = {
  newTapeHashCount: number;
  priorTapesChecked: number;
  totalMatchedAccounts: number; // unique hashes that matched ANY prior
  matches: DoubleSoldMatch[];
  // Row indices in the new tape where matches were detected — operator
  // joins back to PII via their own tape.
  matchedRowIndices: number[];
  // Estimated matched face value (from the new tape's perspective)
  matchedFaceValueInNewTape: number;
  // Total face value of new tape (passed in for context)
  totalFaceValueInNewTape: number;
};

export type NewTapeAccount = {
  rowIndex: number; // 1-based for display alignment
  hash: string;
  faceValue: number;
};

export function checkDoubleSold(input: {
  newTapeAccounts: NewTapeAccount[];
  priorFingerprints: StoredTapeFingerprint[];
  totalFaceValueInNewTape: number;
}): DoubleSoldReport {
  const newHashes = input.newTapeAccounts.map((a) => a.hash);
  const newHashToRow = new Map<string, NewTapeAccount[]>();
  for (const a of input.newTapeAccounts) {
    const list = newHashToRow.get(a.hash) ?? [];
    list.push(a);
    newHashToRow.set(a.hash, list);
  }
  const newHashSet = new Set(newHashes);

  const matchedHashesGlobal = new Set<string>();
  const matches: DoubleSoldMatch[] = [];

  for (const prior of input.priorFingerprints) {
    const priorSet = new Set(prior.hashes);
    let matchedCount = 0;
    for (const h of priorSet) {
      if (newHashSet.has(h)) {
        matchedCount++;
        matchedHashesGlobal.add(h);
      }
    }
    if (matchedCount > 0) {
      matches.push({
        priorTapeId: prior.tapeId,
        priorTapeFileName: prior.fileName,
        priorTapeCreatedAt: prior.createdAt,
        matchedHashCount: matchedCount,
        overlapPctOfNew: newHashes.length > 0 ? (matchedCount / newHashes.length) * 100 : 0,
        overlapPctOfPrior: prior.hashes.length > 0 ? (matchedCount / prior.hashes.length) * 100 : 0,
      });
    }
  }

  matches.sort((a, b) => b.matchedHashCount - a.matchedHashCount);

  // Build row-index + face-value rollup for matched hashes
  const matchedRowIndices: number[] = [];
  let matchedFaceValue = 0;
  for (const h of matchedHashesGlobal) {
    const rows = newHashToRow.get(h) ?? [];
    for (const r of rows) {
      matchedRowIndices.push(r.rowIndex);
      matchedFaceValue += r.faceValue;
    }
  }
  matchedRowIndices.sort((a, b) => a - b);

  return {
    newTapeHashCount: newHashes.length,
    priorTapesChecked: input.priorFingerprints.length,
    totalMatchedAccounts: matchedHashesGlobal.size,
    matches,
    matchedRowIndices,
    matchedFaceValueInNewTape: matchedFaceValue,
    totalFaceValueInNewTape: input.totalFaceValueInNewTape,
  };
}

// ---------------------------------------------------------------------------
// High-level helper: fingerprint a tape's records, returning the data
// the UI needs (hash list + row-index map + total face).
//
// Accepts raw row records (Record<string,string>) plus the canonical
// header names so it works directly off the SchemaDetection produced by
// tape-canonical-schema. All hashing is async via Web Crypto.
// ---------------------------------------------------------------------------

export type FingerprintHeaders = {
  accountNumberHeader: string | null;
  dobHeader: string | null;
  ssnLast4Header: string | null;
  balanceHeader: string | null;
  originatorHeader: string | null;
  openDateHeader: string | null;
};

export async function fingerprintTapeRows(
  records: Record<string, string>[],
  headers: FingerprintHeaders,
  salt: string
): Promise<{
  accounts: NewTapeAccount[];
  totalFaceValue: number;
}> {
  if (!headers.accountNumberHeader && !headers.dobHeader && !headers.ssnLast4Header) {
    // Without any PII anchors, fingerprinting is meaningless — return empty
    return { accounts: [], totalFaceValue: 0 };
  }
  const accounts: NewTapeAccount[] = [];
  let totalFace = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const balRaw = headers.balanceHeader ? r[headers.balanceHeader] : "";
    const balNum =
      balRaw && Number.isFinite(Number(balRaw.toString().replace(/[$,\s]/g, "")))
        ? Number(balRaw.toString().replace(/[$,\s]/g, ""))
        : 0;
    totalFace += balNum > 0 ? balNum : 0;
    const accountNumber = headers.accountNumberHeader
      ? (r[headers.accountNumberHeader] ?? "").trim()
      : "";
    const dob = headers.dobHeader ? (r[headers.dobHeader] ?? "").trim() : "";
    const ssnLast4 = headers.ssnLast4Header
      ? (r[headers.ssnLast4Header] ?? "").trim()
      : "";
    const originator = headers.originatorHeader
      ? (r[headers.originatorHeader] ?? "").trim()
      : "";
    const openDate = headers.openDateHeader
      ? (r[headers.openDateHeader] ?? "").trim()
      : "";
    // Skip rows that have no PII anchors at all — can't fingerprint
    if (!accountNumber && !dob && !ssnLast4) continue;
    const hash = await hashAccount(
      {
        accountNumber: accountNumber || undefined,
        dob: dob || undefined,
        ssnLast4: ssnLast4 || undefined,
        originator: originator || undefined,
        balance: balNum > 0 ? balNum : undefined,
        openDate: openDate || undefined,
      },
      salt
    );
    accounts.push({ rowIndex: i + 1, hash, faceValue: balNum > 0 ? balNum : 0 });
  }
  return { accounts, totalFaceValue: totalFace };
}

// ---------------------------------------------------------------------------
// CSV export: matched-row-index list (privacy-preserving). Operator joins
// back to their own tape to recover PII.
// ---------------------------------------------------------------------------

export function matchedRowsCsv(
  report: DoubleSoldReport,
  newTapeAccounts: NewTapeAccount[]
): string {
  const newByRow = new Map<number, NewTapeAccount>();
  for (const a of newTapeAccounts) newByRow.set(a.rowIndex, a);
  const lines = ["row_index,face_value,matched_prior_tapes"];
  for (const idx of report.matchedRowIndices) {
    const acc = newByRow.get(idx);
    const face = acc?.faceValue ?? 0;
    // Count how many prior tapes this hash was in
    let count = 0;
    if (acc) {
      for (const m of report.matches) {
        if (m.matchedHashCount > 0) count++; // approximation; precise count would re-walk
      }
    }
    lines.push(`${idx},${face.toFixed(2)},${count}`);
  }
  return lines.join("\n");
}
