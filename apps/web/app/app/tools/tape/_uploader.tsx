"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyze,
  ASSET_DEFAULTS,
  computeBid,
  suggestDefaults,
  type AssetDefaults,
  type TapeAggregates,
} from "@/lib/tape-analyzer";
import {
  CANONICAL_FIELDS,
  type FieldCategory,
} from "@/lib/tape-canonical-schema";
import type { BalanceConvention } from "@/lib/tape-originator-fingerprint";
import { cliffQueueToCsv, type SolReport } from "@/lib/tape-sol";
import {
  ALL_US_STATES,
  NO_LICENSE_REQUIRED_STATES,
  computeLicenseImpact,
  readEffectiveLicenseMap,
  readLicensePolicy,
  writeLicensePolicy,
  type EffectiveLicenseMap,
  type LicenseImpact,
  type LicensePolicy,
} from "@/lib/tape-license-map";
import {
  DEFAULT_CONCENTRATION_POLICY,
  computeConcentrationReport,
  readConcentrationPolicy,
  writeConcentrationPolicy,
  type ConcentrationBreach,
  type ConcentrationPolicy,
  type ConcentrationReport,
} from "@/lib/tape-concentration-policy";
import type { MemoInput } from "@/lib/tape-memo-llm";
import {
  DOC_CATEGORY_LABELS,
  analyzeMediaZip,
  extractTapeAccountInputs,
  missingDocsCsv,
  type ChainOfCustodyReport,
  type DocCategory,
} from "@/lib/tape-chain-of-custody";
import {
  computeCompSet,
  type CompSetReport,
} from "@/lib/bid-comp-set";
import { TapeRuleAlerts } from "./_tape-rule-alerts";
import {
  checkDoubleSold,
  clearAllFingerprints,
  deleteTapeFingerprint,
  fingerprintTapeRows,
  getOrCreateInstallSalt,
  matchedRowsCsv,
  readFingerprintStore,
  saveTapeFingerprint,
  type DoubleSoldReport,
  type FingerprintHeaders,
  type NewTapeAccount,
  type StoredTapeFingerprint,
} from "@/lib/tape-fingerprint";
import { parseCsv } from "@/lib/tape-analyzer";
import {
  matchServicersForTape,
  type MatcherHolding,
  type ServicerMatchReport,
} from "@/lib/servicer-matcher";
import { readCollections, type HoldingCollections } from "@/lib/collections";

// Pipeline storage — must match apps/web/app/app/pipeline/_pipeline-board.tsx
const PIPELINE_STORAGE_KEY = "tradeline.pipeline.deals.v1";

type PipelineDealMinimal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage:
    | "sourced"
    | "reviewing"
    | "underwriting"
    | "bidding"
    | "won"
    | "lost"
    | "walked";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

// A handful of curated sample tapes that exercise different paths through the
// analyzer (mix of asset classes, vintages, state concentrations). Each one
// shows the bid math under a different deal profile so first-time visitors see
// what the copilot is actually doing.
//
// All accounts here are SYNTHETIC. Names/phones/SSNs are zero-padded
// placeholders so it's visibly fake; the parser strips PII columns anyway.
type SampleTape = {
  id: string;
  label: string;
  description: string;
  csv: string;
};

const SAMPLE_TAPES: SampleTape[] = [
  {
    id: "card-fresh",
    label: "Fresh credit card · $2.1M face",
    description:
      "30-account credit-card tape, 6-12 month vintages, mid-Atlantic + south concentration. Typical first-tape size from a regional bank broker.",
    csv: [
      "account_balance,state,charge_off_date,asset_type,first_name,last_name,phone,ssn",
      "85234.12,GA,2025-09-15,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "41822.55,VA,2025-11-02,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "112450.00,NY,2025-07-20,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "27011.18,CA,2025-08-08,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "93840.40,TX,2025-12-11,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "67129.99,FL,2025-10-28,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "43500.00,GA,2025-09-29,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "21994.45,NC,2025-07-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "89005.50,MD,2025-11-19,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "14500.00,VA,2025-08-22,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "58200.00,SC,2025-06-30,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "39100.00,TN,2025-10-05,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "72400.00,AL,2025-08-18,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "18800.00,MS,2025-09-12,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "104500.00,LA,2025-07-11,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "55900.00,KY,2025-11-25,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "33000.00,GA,2025-12-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "47600.00,VA,2025-10-15,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "29800.00,WV,2025-09-22,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "61700.00,DC,2025-08-30,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "92500.00,MD,2025-07-28,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "17400.00,DE,2025-10-09,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "53200.00,PA,2025-06-19,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "38900.00,NJ,2025-08-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "76100.00,CT,2025-11-14,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "24800.00,RI,2025-09-26,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "44600.00,MA,2025-07-17,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "31200.00,NH,2025-10-31,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "82400.00,ME,2025-08-13,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "15600.00,VT,2025-12-08,credit card,Sample,Sample,000-000-0000,000-00-0000",
    ].join("\n"),
  },
  {
    id: "card-aged",
    label: "Aged credit card · $1.4M face · 2-3yr vintage",
    description:
      "Junky tape — older vintages, mixed states, more skips expected. Price discipline matters here: the math says walk unless you can buy at 1.5¢/$ or below.",
    csv: [
      "account_balance,state,charge_off_date,asset_type,first_name,last_name,phone,ssn",
      "92340.00,TX,2023-04-12,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "55180.00,FL,2023-06-22,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "71200.00,CA,2022-11-08,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "38400.00,NY,2023-02-15,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "104500.00,GA,2022-09-30,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "67800.00,IL,2023-07-19,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "23400.00,OH,2023-05-04,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "88900.00,PA,2022-12-11,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "41200.00,NC,2023-03-26,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "76500.00,MI,2022-10-17,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "29800.00,AZ,2023-08-09,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "112400.00,NV,2022-07-23,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "47600.00,WA,2023-01-14,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "63200.00,CO,2022-08-28,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "35900.00,UT,2023-06-05,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "81700.00,OR,2022-11-21,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "26400.00,KS,2023-04-29,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "98300.00,MO,2022-09-13,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "54200.00,IN,2023-07-30,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "39800.00,WI,2022-12-04,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
    ].join("\n"),
  },
  {
    id: "mortgage-junior",
    label: "Junior mortgage · $4.8M face · seasoned",
    description:
      "Smaller account count, much larger per-account balances. Different math entirely — recovery is much higher because there's collateral, workout takes longer.",
    csv: [
      "balance,state,vintage,asset_type,first_name,last_name,phone",
      "245000,GA,2021-03-15,junior mortgage,Sample,Sample,000-000-0000",
      "318500,FL,2020-11-22,junior mortgage,Sample,Sample,000-000-0000",
      "412700,CA,2021-06-08,junior mortgage,Sample,Sample,000-000-0000",
      "189400,NY,2020-09-30,junior mortgage,Sample,Sample,000-000-0000",
      "354800,TX,2021-04-19,junior mortgage,Sample,Sample,000-000-0000",
      "276100,NC,2020-12-11,junior mortgage,Sample,Sample,000-000-0000",
      "498300,MD,2021-07-26,junior mortgage,Sample,Sample,000-000-0000",
      "223600,VA,2020-10-17,junior mortgage,Sample,Sample,000-000-0000",
      "395200,PA,2021-05-04,junior mortgage,Sample,Sample,000-000-0000",
      "267900,NJ,2020-08-23,junior mortgage,Sample,Sample,000-000-0000",
      "341500,CT,2021-02-14,junior mortgage,Sample,Sample,000-000-0000",
      "298400,MA,2020-11-28,junior mortgage,Sample,Sample,000-000-0000",
      "452800,WA,2021-06-05,junior mortgage,Sample,Sample,000-000-0000",
      "186200,OR,2020-09-21,junior mortgage,Sample,Sample,000-000-0000",
      "513000,CO,2021-04-29,junior mortgage,Sample,Sample,000-000-0000",
    ].join("\n"),
  },
  {
    id: "auto-recent",
    label: "Auto (subprime) · $890k face · recent",
    description:
      "Subprime auto, secured by the vehicle. Different recovery curve from unsecured paper. Servicer matters a lot here — vehicle title workflows are specialist work.",
    csv: [
      "face_value,billing_state,co_date,product,first_name,last_name",
      "18400,GA,2025-01-22,auto subprime,Sample,Sample",
      "22100,TX,2024-11-14,auto subprime,Sample,Sample",
      "15600,FL,2025-03-08,auto subprime,Sample,Sample",
      "27300,NC,2024-10-29,auto subprime,Sample,Sample",
      "19800,AL,2025-02-17,auto subprime,Sample,Sample",
      "31400,MS,2024-12-04,auto subprime,Sample,Sample",
      "23900,LA,2025-01-30,auto subprime,Sample,Sample",
      "16200,SC,2024-09-18,auto subprime,Sample,Sample",
      "28600,TN,2025-04-11,auto subprime,Sample,Sample",
      "20100,KY,2024-11-26,auto subprime,Sample,Sample",
      "33700,WV,2025-02-22,auto subprime,Sample,Sample",
      "24500,VA,2024-12-19,auto subprime,Sample,Sample",
      "17800,MD,2025-03-15,auto subprime,Sample,Sample",
      "30200,PA,2024-10-08,auto subprime,Sample,Sample",
      "21400,OH,2025-01-04,auto subprime,Sample,Sample",
      "26800,IN,2024-11-21,auto subprime,Sample,Sample",
      "19500,IL,2025-03-26,auto subprime,Sample,Sample",
      "32100,MO,2024-12-14,auto subprime,Sample,Sample",
      "23600,AR,2025-02-08,auto subprime,Sample,Sample",
      "28900,OK,2024-10-31,auto subprime,Sample,Sample",
      "20700,KS,2025-01-19,auto subprime,Sample,Sample",
      "25400,NE,2024-11-07,auto subprime,Sample,Sample",
      "31800,IA,2025-03-04,auto subprime,Sample,Sample",
      "22300,WI,2024-12-22,auto subprime,Sample,Sample",
      "29100,MI,2025-02-13,auto subprime,Sample,Sample",
      "18900,MN,2024-10-26,auto subprime,Sample,Sample",
      "27600,ND,2025-04-02,auto subprime,Sample,Sample",
      "23100,SD,2024-11-13,auto subprime,Sample,Sample",
      "30500,MT,2025-01-27,auto subprime,Sample,Sample",
      "21700,WY,2024-12-09,auto subprime,Sample,Sample",
      "26200,ID,2025-03-21,auto subprime,Sample,Sample",
      "19300,NV,2024-10-15,auto subprime,Sample,Sample",
      "32700,UT,2025-02-28,auto subprime,Sample,Sample",
      "24800,AZ,2024-11-30,auto subprime,Sample,Sample",
      "28400,NM,2025-01-12,auto subprime,Sample,Sample",
    ].join("\n"),
  },
];

export function TapeUploader() {
  const [filename, setFilename] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<TapeAggregates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [overrides, setOverrides] = useState<AssetDefaults | null>(null);
  const [savedDealId, setSavedDealId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [brokerName, setBrokerName] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [askInput, setAskInput] = useState("");
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [licensePolicy, setLicensePolicy] = useState<LicensePolicy | null>(null);
  const [effectiveLicense, setEffectiveLicense] = useState<EffectiveLicenseMap>({
    source: "none",
    licensedStates: [],
    stateExpiries: new Map(),
    rawLicenseCount: 0,
  });
  const [concentrationPolicy, setConcentrationPolicy] = useState<ConcentrationPolicy | null>(null);
  const [memoMarkdown, setMemoMarkdown] = useState<string | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [cocReport, setCocReport] = useState<ChainOfCustodyReport | null>(null);
  const [cocLoading, setCocLoading] = useState(false);
  const [cocError, setCocError] = useState<string | null>(null);
  const [cocMediaName, setCocMediaName] = useState<string | null>(null);
  // Cross-tape double-sold detection state
  const [doubleSoldReport, setDoubleSoldReport] = useState<DoubleSoldReport | null>(null);
  const [doubleSoldAccounts, setDoubleSoldAccounts] = useState<NewTapeAccount[]>([]);
  const [doubleSoldLoading, setDoubleSoldLoading] = useState(false);
  const [priorFingerprints, setPriorFingerprints] = useState<StoredTapeFingerprint[]>([]);
  const searchParams = useSearchParams();
  const autoLoadedRef = useRef(false);
  // Raw CSV text held in a ref (not state) for the chain-of-custody flow.
  // Stays in browser memory only; never sent to any server.
  const rawCsvRef = useRef<string | null>(null);

  // Load operator policies from localStorage on mount.
  useEffect(() => {
    setLicensePolicy(readLicensePolicy());
    setEffectiveLicense(readEffectiveLicenseMap());
    setConcentrationPolicy(readConcentrationPolicy());
    setPriorFingerprints(readFingerprintStore().tapes);
  }, []);

  // Cross-tape match check — fires after every successful decode. Async
  // because hashing uses Web Crypto. Auto-saves the new tape's fingerprint
  // to localStorage so the next decode can match against it.
  useEffect(() => {
    if (!aggregates || !rawCsvRef.current) return;
    const csvText = rawCsvRef.current;
    let cancelled = false;
    (async () => {
      setDoubleSoldLoading(true);
      try {
        const { headers, records } = parseCsv(csvText);
        const headerHints: FingerprintHeaders = {
          accountNumberHeader:
            aggregates.schema.byCanonical.get("original_account_number")?.header ?? null,
          dobHeader: aggregates.schema.byCanonical.get("date_of_birth")?.header ?? null,
          ssnLast4Header:
            aggregates.schema.byCanonical.get("ssn_last_4")?.header ??
            aggregates.schema.byCanonical.get("ssn")?.header ??
            null,
          balanceHeader:
            aggregates.schema.byCanonical.get("account_balance")?.header ??
            aggregates.schema.byCanonical.get("charge_off_balance")?.header ??
            aggregates.hints.balance ??
            null,
          originatorHeader:
            aggregates.schema.byCanonical.get("originating_creditor")?.header ?? null,
          openDateHeader:
            aggregates.schema.byCanonical.get("account_opened_date")?.header ?? null,
        };
        // Silently skip if no PII anchors are present — fingerprinting is
        // meaningless without at least an account number / DOB / SSN tail.
        if (!headerHints.accountNumberHeader && !headerHints.dobHeader && !headerHints.ssnLast4Header) {
          if (!cancelled) {
            setDoubleSoldReport(null);
            setDoubleSoldAccounts([]);
            setDoubleSoldLoading(false);
          }
          // Silence the unused-headers warning since we returned early.
          void headers;
          void records;
          return;
        }
        const salt = getOrCreateInstallSalt();
        const { accounts, totalFaceValue } = await fingerprintTapeRows(records, headerHints, salt);
        if (cancelled) return;
        // Check against prior tapes BEFORE saving the new one (so the
        // check doesn't trivially match against itself)
        const prior = readFingerprintStore().tapes;
        const report = checkDoubleSold({
          newTapeAccounts: accounts,
          priorFingerprints: prior,
          totalFaceValueInNewTape: totalFaceValue,
        });
        // Auto-save the new tape's fingerprint
        if (accounts.length > 0) {
          saveTapeFingerprint({
            fileName: filename || "Untitled tape",
            hashes: accounts.map((a) => a.hash),
            accountCount: records.length,
            totalFaceValue,
          });
          setPriorFingerprints(readFingerprintStore().tapes);
        }
        setDoubleSoldReport(report);
        setDoubleSoldAccounts(accounts);
      } catch {
        if (!cancelled) {
          setDoubleSoldReport(null);
          setDoubleSoldAccounts([]);
        }
      } finally {
        if (!cancelled) setDoubleSoldLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregates]);

  const preset: AssetDefaults = overrides ?? ASSET_DEFAULTS[presetIdx];

  const bid = useMemo(() => {
    if (!aggregates) return null;
    return computeBid({
      totalFaceValue: aggregates.totalFaceValue,
      recoveryPct: preset.recoveryPct,
      workoutYears: preset.workoutYears,
      servicerFeePct: preset.servicerFeePct,
      irrPct: preset.irrPct,
    });
  }, [aggregates, preset]);

  function processText(text: string, source: string) {
    try {
      setError(null);
      const result = analyze(text);
      setAggregates(result);
      setFilename(source);
      // Hold raw CSV for the chain-of-custody flow (in-memory only).
      rawCsvRef.current = text;
      // Reset any prior chain-of-custody report — it's tape-specific.
      setCocReport(null);
      setCocError(null);
      setCocMediaName(null);
      // Suggest defaults from detected asset class
      const top = result.assetClassDistribution[0]?.name;
      if (top) {
        const suggested = suggestDefaults(top);
        const idx = ASSET_DEFAULTS.findIndex((d) => d.label === suggested.label);
        if (idx >= 0) setPresetIdx(idx);
        setOverrides(null);
      }
    } catch (err) {
      setError((err as Error).message || "Failed to parse tape");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveSampleId(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      processText(text, file.name);
    };
    reader.readAsText(file);
  }

  function loadSample(id: string) {
    const sample = SAMPLE_TAPES.find((s) => s.id === id);
    if (!sample) return;
    processText(sample.csv, `${sample.label} (sample)`);
    setActiveSampleId(id);
    // Scroll the results section into view so the user immediately sees
    // what they triggered.
    setTimeout(() => {
      const el = document.getElementById("tape-results");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  // Deep-link support: /app/tools/tape?demo=card-fresh (or any sample id)
  // auto-loads that sample once on mount. Lets external pages — homepage
  // CTA, /about page, even the email digest — send a visitor straight into
  // an analyzed sample without requiring them to find and click a chip.
  useEffect(() => {
    if (autoLoadedRef.current) return;
    const demo = searchParams?.get("demo");
    if (!demo) return;
    const sample = SAMPLE_TAPES.find((s) => s.id === demo);
    if (!sample) return;
    autoLoadedRef.current = true;
    loadSample(demo);
    // We intentionally only run this on mount. searchParams is stable for
    // the lifetime of the page; changing it later would not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    setAggregates(null);
    setFilename(null);
    setError(null);
    setOverrides(null);
    setSavedDealId(null);
    setShowSaveForm(false);
    setBrokerName("");
    setTickerInput("");
    setAskInput("");
    setActiveSampleId(null);
    setMemoMarkdown(null);
    setMemoError(null);
    setCocReport(null);
    setCocError(null);
    setCocMediaName(null);
    rawCsvRef.current = null;
  }

  function saveToPipeline() {
    if (!aggregates || !bid) return;
    const now = new Date().toISOString();
    const topAsset = aggregates.assetClassDistribution[0]?.name || preset.label;
    // Map tape asset label onto a pipeline asset class enum (loose match)
    const pipelineAsset = mapToPipelineAssetClass(topAsset);
    const summary = [
      `Tape eval: ${aggregates.rowCount.toLocaleString()} accounts, ${formatUSD(aggregates.totalFaceValue)} face.`,
      aggregates.stateDistribution.length > 0
        ? `Top states: ${aggregates.stateDistribution
            .slice(0, 3)
            .map((s) => s.state)
            .join("/")}.`
        : "",
      aggregates.vintageDistribution.length > 0
        ? `Vintages: ${aggregates.vintageDistribution.map((v) => v.period).slice(-3).join(", ")}.`
        : "",
      `Disciplined bid (${preset.label}): ${formatUSD(bid.disciplinedBid)} (${bid.disciplinedBidCentsPerDollar.toFixed(2)}¢/$).`,
      `Max bid: ${formatUSD(bid.maxBid)} (${bid.maxBidCentsPerDollar.toFixed(2)}¢/$).`,
      filename ? `Source: ${filename}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const deal: PipelineDealMinimal = {
      id: newId(),
      ticker: tickerInput.trim().toUpperCase(),
      brokerName: brokerName.trim() || "—",
      assetClass: pipelineAsset,
      faceValueUsd: aggregates.totalFaceValue,
      askCentsPerDollar: askInput ? Number(askInput) || undefined : undefined,
      bidCentsPerDollar: Number(bid.disciplinedBidCentsPerDollar.toFixed(2)),
      stage: "reviewing",
      notes: summary,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
      const existing: PipelineDealMinimal[] = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];
      window.localStorage.setItem(
        PIPELINE_STORAGE_KEY,
        JSON.stringify([deal, ...arr])
      );
      setSavedDealId(deal.id);
      setShowSaveForm(false);
    } catch (err) {
      setError("Failed to save to pipeline: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      {/* DROP ZONE */}
      <section className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Step 1 · Upload a tape (CSV)
        </div>
        <h2 className="mt-2 text-2xl font-medium tracking-tight">
          Drop a tape. Get aggregates.
        </h2>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          The file is parsed in your browser and immediately discarded. PII columns
          (name, address, phone, SSN, account number) are skipped — Tradeline never
          stores or transmits row-level data.
        </p>

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <label className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition cursor-pointer">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {aggregates && (
            <button
              type="button"
              onClick={clear}
              className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
            >
              Clear
            </button>
          )}
          {filename && (
            <span className="font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
              {filename}
            </span>
          )}
        </div>

        {/* Sample picker — primary CTA for first-time visitors who don't have a real tape yet. */}
        <div
          className="mt-6 rounded-xl p-5"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            No tape yet? Try a sample
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Each sample is a curated synthetic CSV that exercises a different
            asset profile so you can see the bid math under different deal
            shapes. Loading a sample auto-detects the asset class, suggests
            the right recovery defaults, and scrolls to the analysis.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {SAMPLE_TAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id)}
                title={s.description}
                className={`font-mono text-[11px] tracking-[0.05em] px-3 py-2 rounded transition ${
                  activeSampleId === s.id
                    ? "border border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                }`}
              >
                {activeSampleId === s.id ? "★ " : ""}
                {s.label}
              </button>
            ))}
          </div>
          {activeSampleId && (
            <p className="mt-3 text-[11px] font-mono text-[color:var(--color-fg-faint)] leading-relaxed">
              {SAMPLE_TAPES.find((s) => s.id === activeSampleId)?.description}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-5 border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-4 text-[14px] text-[color:var(--color-danger)]">
            {error}
          </div>
        )}
      </section>

      {/* Demo banner — visible above results when a sample is loaded */}
      {aggregates && activeSampleId && (
        <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-[color:var(--color-warn)] leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase mr-2">
              Demo data
            </span>
            All accounts below are synthetic. Save-to-pipeline still works so
            you can see the round-trip into{" "}
            <Link href="/app/pipeline" className="underline hover:opacity-80">
              /app/pipeline
            </Link>
            .
          </div>
          <button
            type="button"
            onClick={clear}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-warn)] text-[color:var(--color-warn)] hover:bg-[color:var(--color-warn)] hover:text-[color:var(--color-bg)] transition"
          >
            Clear sample
          </button>
        </div>
      )}

      {/* RESULTS */}
      {aggregates && (
        <>
          {/* Headline aggregates */}
          <section id="tape-results">
            <SectionLabel>Step 2 · Tape aggregates</SectionLabel>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat label="Accounts" value={aggregates.rowCount.toLocaleString()} />
              <Stat
                label="Face value"
                value={formatUSD(aggregates.totalFaceValue)}
                tone="ok"
              />
              <Stat
                label="Avg balance"
                value={formatUSD(aggregates.averageBalance)}
              />
              <Stat
                label="Median"
                value={formatUSD(aggregates.medianBalance)}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat label="Min" value={formatUSD(aggregates.minBalance)} />
              <Stat label="Max" value={formatUSD(aggregates.maxBalance)} />
              <Stat
                label="States"
                value={aggregates.stateDistribution.length}
              />
              <Stat
                label="Vintage years"
                value={aggregates.vintageDistribution.length}
              />
            </div>

            {aggregates.warnings.length > 0 && (
              <div className="mt-4 border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-4">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
                  Tape quality flags
                </div>
                <ul className="mt-2 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {aggregates.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className="mt-5 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap"
              style={{
                background:
                  "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                border: "1.5px solid transparent",
              }}
            >
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                  Next action
                </div>
                <div className="mt-0.5 text-[14px] text-[color:var(--color-fg)]">
                  Your tape is scored. Now compose the bid email back to the broker.
                </div>
                <div className="mt-0.5 text-[11px] text-[color:var(--color-fg-dim)]">
                  Face value of <strong className="text-[color:var(--color-fg)]">{formatUSD(aggregates.totalFaceValue)}</strong> auto-passes to the calculator.
                </div>
              </div>
              <Link
                href={`/app/tools/bid-calculator?face=${aggregates.totalFaceValue}`}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                Compose bid email →
              </Link>
            </div>
          </section>

          {/* DEEP SCHEMA ANALYSIS */}
          <DeepAnalysisCard aggregates={aggregates} />

          {/* STATUTE-OF-LIMITATIONS REPORT */}
          {aggregates.solReport && (
            <SolReportSection report={aggregates.solReport} totalFaceValue={aggregates.totalFaceValue} filename={filename} />
          )}

          {/* LICENSE COVERAGE */}
          <LicenseCoverageSection
            effective={effectiveLicense}
            policy={licensePolicy}
            onPolicyChange={(p) => {
              setLicensePolicy(p);
              writeLicensePolicy(p);
              setEffectiveLicense(readEffectiveLicenseMap());
            }}
            stateDistribution={aggregates.stateDistribution}
          />

          {/* CONCENTRATION BREACH */}
          <ConcentrationSection
            policy={concentrationPolicy}
            onPolicyChange={(p) => {
              setConcentrationPolicy(p);
              writeConcentrationPolicy(p);
            }}
            aggregates={aggregates}
          />

          {/* RULE-CHANGE ALERTS — regulatory shifts that touch this tape */}
          <TapeRuleAlerts
            stateDistribution={aggregates.stateDistribution}
            totalFaceValue={aggregates.totalFaceValue}
            assetClasses={aggregates.assetClassDistribution.map((a) => a.name)}
          />

          {/* CROSS-TAPE DOUBLE-SOLD DETECTION */}
          <DoubleSoldSection
            report={doubleSoldReport}
            accounts={doubleSoldAccounts}
            loading={doubleSoldLoading}
            priorFingerprints={priorFingerprints}
            filename={filename}
            onClearAll={() => {
              if (typeof window === "undefined") return;
              if (!confirm("Clear all saved tape fingerprints? This cannot be undone.")) return;
              clearAllFingerprints();
              setPriorFingerprints([]);
              setDoubleSoldReport(null);
            }}
            onDeleteTape={(tapeId) => {
              if (typeof window === "undefined") return;
              if (!confirm("Delete this saved fingerprint?")) return;
              deleteTapeFingerprint(tapeId);
              setPriorFingerprints(readFingerprintStore().tapes);
            }}
          />

          {/* CHAIN-OF-CUSTODY (the killer differentiator) */}
          <ChainOfCustodySection
            tapeFaceValue={aggregates.totalFaceValue}
            report={cocReport}
            loading={cocLoading}
            error={cocError}
            mediaName={cocMediaName}
            filename={filename}
            onMediaSelected={async (file) => {
              if (!rawCsvRef.current) {
                setCocError("No tape loaded — re-upload your CSV first.");
                return;
              }
              setCocLoading(true);
              setCocError(null);
              setCocMediaName(file.name);
              try {
                const extracted = extractTapeAccountInputs(rawCsvRef.current);
                if (extracted.accounts.length === 0) {
                  if (!extracted.accountNumberHeader) {
                    setCocError(
                      "No account-number column detected on the tape — cannot match docs to accounts. Re-upload a tape that includes an account-number column."
                    );
                  } else {
                    setCocError("No accounts extracted from tape.");
                  }
                  setCocLoading(false);
                  return;
                }
                const zipBytes = new Uint8Array(await file.arrayBuffer());
                const report = await analyzeMediaZip(zipBytes, extracted.accounts);
                setCocReport(report);
              } catch (err) {
                setCocError((err as Error).message ?? "Failed to parse media zip");
              } finally {
                setCocLoading(false);
              }
            }}
            onClear={() => {
              setCocReport(null);
              setCocError(null);
              setCocMediaName(null);
            }}
          />

          {/* Distributions */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DistCard
              title="Geographic mix"
              empty={
                aggregates.hints.state
                  ? "No states parsed."
                  : "No state column detected."
              }
              items={aggregates.stateDistribution.map((s) => ({
                key: s.state,
                count: s.count,
                faceValue: s.faceValue,
              }))}
            />
            <DistCard
              title="Vintage distribution"
              empty={
                aggregates.hints.vintage
                  ? "No vintages parsed."
                  : "No vintage column detected."
              }
              items={aggregates.vintageDistribution.map((v) => ({
                key: v.period,
                count: v.count,
                faceValue: v.faceValue,
              }))}
            />
            <DistCard
              title="Asset classes"
              empty={
                aggregates.hints.assetClass
                  ? "No asset classes parsed."
                  : "Single-class tape (no breakdown column)."
              }
              items={aggregates.assetClassDistribution.map((a) => ({
                key: a.name,
                count: a.count,
                faceValue: a.faceValue,
              }))}
            />
          </section>

          {/* Bid heuristic */}
          {bid && (
            <section>
              <SectionLabel>Step 3 · Suggested bid (NPV at target IRR)</SectionLabel>
              <p className="mt-2 mb-4 text-[13px] text-[color:var(--color-fg-dim)] max-w-2xl">
                Asset-class defaults applied. Override the preset if you have
                better recovery data; the math is the same as{" "}
                <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
                  /app/tools/bid-calculator
                </code>{" "}
                applied to this tape&rsquo;s face value.
              </p>

              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {ASSET_DEFAULTS.map((d, i) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => {
                      setPresetIdx(i);
                      setOverrides(null);
                    }}
                    className={`font-mono text-[11px] tracking-[0.05em] uppercase px-3 py-2 border transition ${
                      preset.label === d.label && !overrides
                        ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                        : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
                <Stat
                  label="Gross recovery (face × rate)"
                  value={formatUSD(bid.grossRecovery)}
                />
                <Stat
                  label="Net to you (after servicer)"
                  value={formatUSD(bid.netToBuyer)}
                  tone="ok"
                />
                <Stat
                  label="Max bid (NPV at IRR)"
                  value={formatUSD(bid.maxBid)}
                  sub={`${formatPct(bid.maxBidCentsPerDollar, 2)} of face`}
                  tone="strong"
                />
              </div>

              {/* Save to pipeline */}
              <div className="mt-6 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                  Step 4 · Save to pipeline
                </div>
                {savedDealId ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-[14px] text-[color:var(--color-success)]">
                      ✓ Saved as a Reviewing deal. Now bid it back.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/app/tools/bid-calculator?face=${aggregates?.totalFaceValue ?? 0}&ticker=${encodeURIComponent(tickerInput.trim())}&bank=${encodeURIComponent(brokerName.trim())}&broker=${encodeURIComponent(brokerName.trim())}`}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        Compose bid email →
                      </Link>
                      <Link
                        href="/app/pipeline"
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 transition"
                      >
                        Open Pipeline →
                      </Link>
                    </div>
                  </div>
                ) : showSaveForm ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <SmallInput
                        label="Broker"
                        value={brokerName}
                        onChange={setBrokerName}
                        placeholder="e.g. Garnet Capital"
                      />
                      <SmallInput
                        label="Originator ticker"
                        value={tickerInput}
                        onChange={setTickerInput}
                        placeholder="e.g. WAL"
                      />
                      <SmallInput
                        label="Ask price (¢/$)"
                        value={askInput}
                        onChange={setAskInput}
                        placeholder="optional"
                        type="number"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={saveToPipeline}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                      >
                        Save deal
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveForm(false)}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <p className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed flex-1 min-w-[200px]">
                      Save this analysis as a deal in your Pipeline. The disciplined
                      bid + summary become the deal record; you fill in the broker
                      and originator.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSaveForm(true)}
                      className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                    >
                      + Save to Pipeline
                    </button>
                  </div>
                )}
              </div>

              {/* COMP-SET CALLOUT — your own history vs. industry defaults */}
              <CompSetCallout
                assetClass={aggregates.assetClassDistribution[0]?.name ?? preset.label}
                faceValueUsd={aggregates.totalFaceValue}
                vintageYear={Number(aggregates.vintageDistribution[aggregates.vintageDistribution.length - 1]?.period) || undefined}
                disciplinedBidCentsPerDollar={bid.disciplinedBidCentsPerDollar}
              />

              <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                  Recommendation
                </div>
                <p className="mt-2 text-[15px] text-[color:var(--color-fg)] leading-relaxed">
                  At <span className="font-mono">{preset.label}</span> defaults
                  ({formatPct(preset.recoveryPct, 1)} recovery over{" "}
                  {preset.workoutYears} years, {formatPct(preset.servicerFeePct, 0)}{" "}
                  servicer fee, {formatPct(preset.irrPct, 0)} IRR target):
                </p>
                <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)]">
                  <li>
                    <strong className="text-[color:var(--color-fg)]">Maximum bid</strong>{" "}
                    <span className="font-mono text-[color:var(--color-accent)]">
                      {formatUSD(bid.maxBid)} · {formatPct(bid.maxBidCentsPerDollar, 2)}¢/$
                    </span>{" "}
                    — go above and the math doesn&rsquo;t pencil at your IRR.
                  </li>
                  <li>
                    <strong className="text-[color:var(--color-fg)]">Disciplined bid (15% margin)</strong>{" "}
                    <span className="font-mono text-[color:var(--color-warn)]">
                      {formatUSD(bid.disciplinedBid)} · {formatPct(bid.disciplinedBidCentsPerDollar, 2)}¢/$
                    </span>{" "}
                    — what most experienced buyers actually submit.
                  </li>
                </ul>
                <p className="mt-3 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
                  Heuristic, not a substitute for full underwriting. Adjust recovery
                  expectations if the tape&rsquo;s state mix is heavy in restrictive
                  jurisdictions (NY, MA, MD, CA), if vintage spans &gt; 4 years (lower
                  recovery), or if you&rsquo;re second-or-later buyer (significantly
                  lower recovery).
                </p>
              </div>

              {/* CAPITAL IMPACT — what this bid would do to your book */}
              <CapitalImpactInline
                disciplinedBidDollars={bid.disciplinedBid}
                disciplinedBidCentsPerDollar={bid.disciplinedBidCentsPerDollar}
                tapeFaceValue={aggregates.totalFaceValue}
                tapeAssetClass={aggregates.assetClassDistribution[0]?.name ?? preset.label}
                concentrationPolicy={concentrationPolicy}
              />

              {/* SERVICER MATCH — if you win, where to place */}
              <ServicerMatchSection
                tapeAssetClass={aggregates.assetClassDistribution[0]?.name ?? preset.label}
                tapeFaceValue={aggregates.totalFaceValue}
                tapeVintageYear={
                  Number(aggregates.vintageDistribution[aggregates.vintageDistribution.length - 1]?.period) || undefined
                }
              />

              {/* UNDERWRITING MEMO — AI synthesis of everything above */}
              <UnderwritingMemoSection
                aggregates={aggregates}
                bid={bid}
                preset={preset}
                licensePolicy={licensePolicy}
                concentrationPolicy={concentrationPolicy}
                markdown={memoMarkdown}
                loading={memoLoading}
                error={memoError}
                onGenerate={async () => {
                  if (!aggregates || !bid) return;
                  setMemoLoading(true);
                  setMemoError(null);
                  try {
                    const input = buildMemoInput(
                      aggregates,
                      bid,
                      preset,
                      effectiveLicense,
                      concentrationPolicy
                    );
                    const res = await fetch("/api/tape-memo", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(input),
                    });
                    const data = (await res.json()) as {
                      enabled?: boolean;
                      markdown?: string;
                      message?: string;
                      error?: string;
                    };
                    if (data.enabled === false) {
                      setMemoError(
                        data.message ?? "Memo generator disabled (ANTHROPIC_API_KEY not set)."
                      );
                    } else if (data.error) {
                      setMemoError(data.error);
                    } else if (data.markdown) {
                      setMemoMarkdown(data.markdown);
                    } else {
                      setMemoError("Empty response from memo API.");
                    }
                  } catch (err) {
                    setMemoError((err as Error).message ?? "Network error");
                  } finally {
                    setMemoLoading(false);
                  }
                }}
                onClear={() => {
                  setMemoMarkdown(null);
                  setMemoError(null);
                }}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "strong" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function mapToPipelineAssetClass(detected: string): string {
  const d = detected.toLowerCase();
  if (d.includes("auto") || d.includes("vehicle")) return "Auto";
  if (d.includes("medic") || d.includes("hospital")) return "Medical";
  if (d.includes("mortgage") || d.includes("real")) return "Junior mortgage";
  if (d.includes("commercial")) return "Commercial";
  if (d.includes("specialty")) return "Specialty";
  return "Credit card";
}

function DistCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: { key: string; count: number; faceValue: number }[];
  empty: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-3 text-[13px] text-[color:var(--color-fg-faint)]">{empty}</div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => {
            const pct = total > 0 ? (i.count / total) * 100 : 0;
            return (
              <li
                key={i.key}
                className="flex items-baseline gap-3 font-mono text-[12px]"
              >
                <span className="text-[color:var(--color-accent)] w-12">{i.key}</span>
                <span className="text-[color:var(--color-fg-dim)] flex-1">
                  {i.count.toLocaleString()} ({pct.toFixed(0)}%)
                </span>
                <span className="text-[color:var(--color-fg)] tick">
                  {formatUSD(i.faceValue)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DEEP ANALYSIS — schema grade, Reg F minimum check, originator fingerprint,
// balance convention. Renders the V2 deep-analysis fields the analyzer now
// produces alongside the existing aggregates.
// ---------------------------------------------------------------------------

function DeepAnalysisCard({ aggregates }: { aggregates: TapeAggregates }) {
  const { schema, regF, completeness, fingerprint, balanceConvention } = aggregates;
  const [showDetails, setShowDetails] = useState(false);

  const fp = fingerprint.topMatch;
  const fpConfPct = fp ? Math.round(fp.confidence * 100) : 0;
  const conventionLabel = shortConventionLabel(balanceConvention.convention);
  const conventionTone: AnalysisTone =
    balanceConvention.convention === "include_pre_co_interest_and_fees" ||
    balanceConvention.convention === "include_post_co_interest_judgments_only"
      ? "warn"
      : balanceConvention.convention === "exclude_post_co_interest_and_fees"
      ? "ok"
      : "neutral";

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · Schema &amp; compliance</SectionLabel>
        <GradeBadge grade={completeness.grade} weighted={completeness.weighted} />
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-3xl">
        Tape mapped to the 60-field canonical schema (derived from the
        Spiegel-Midland 2007 SEC filing + Reg F minimums + RMAI categories).
        Below: validation-notice viability, originator family, and balance
        convention — the three things that decide whether your bid is
        well-calibrated.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <AnalysisCard
          tone={regF.pass ? "ok" : "danger"}
          title="Reg F minimum"
          status={regF.pass ? "✓ PASS" : "✗ FAIL"}
          body={
            regF.pass
              ? `All ${regF.satisfiedBy.size} required fields present. Tape can support a 12 CFR 1006.34 validation notice as-is.`
              : `Missing: ${regF.missing.join(", ")}. Tape CANNOT legally support a validation notice — don't bid until seller supplements.`
          }
          source="12 CFR 1006.34(c)(2)"
        />
        <AnalysisCard
          tone={fp && fp.confidence >= 0.5 ? "warn" : "neutral"}
          title="Originator fingerprint"
          status={fp ? `${fp.fingerprint.label} · ${fpConfPct}%` : "No match"}
          body={
            fp?.fingerprint.warnings[0] ??
            "No known issuer pattern matched. Treat as generic; ask seller for naming conventions."
          }
          source={fp?.fingerprint.source}
        />
        <AnalysisCard
          tone={conventionTone}
          title="Balance convention"
          status={conventionLabel}
          body={
            balanceConvention.warning ??
            (balanceConvention.rowsCompared > 0
              ? `Confirmed across ${balanceConvention.rowsCompared.toLocaleString()} sampled rows. Mean delta ${(balanceConvention.meanDelta * 100).toFixed(1)}%.`
              : "Could not determine from row data. Confirm with seller before bidding.")
          }
          source={
            balanceConvention.rowsCompared > 0
              ? `Empirical, n=${balanceConvention.rowsCompared}`
              : "Fingerprint-only inference"
          }
        />
      </div>

      {/* Per-category schema completeness bars */}
      <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Schema completeness by category
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {(Object.entries(completeness.byCategory) as [FieldCategory, { detected: number; total: number }][]).map(
            ([cat, stat]) => {
              const pct = stat.total === 0 ? 0 : (stat.detected / stat.total) * 100;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-[0.05em] text-[color:var(--color-fg-dim)] w-36 shrink-0">
                    {categoryLabel(cat)}
                  </span>
                  <div className="flex-1 h-1.5 bg-[color:var(--color-bg-2)] overflow-hidden rounded-sm">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${pct}%`,
                        background:
                          pct >= 70
                            ? "var(--color-success)"
                            : pct >= 40
                            ? "var(--color-accent)"
                            : pct > 0
                            ? "var(--color-warn)"
                            : "var(--color-line)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] w-16 text-right shrink-0">
                    {stat.detected}/{stat.total}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Expandable field-by-field detail */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 font-mono text-[11px] tracking-[0.15em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
      >
        {showDetails ? "▾ Hide" : "▸ Show"} field-by-field detail · {schema.byCanonical.size} detected · {schema.unmappedHeaders.length} unmapped
      </button>
      {showDetails && <SchemaFieldDetails aggregates={aggregates} />}
    </section>
  );
}

function GradeBadge({ grade, weighted }: { grade: "A" | "B" | "C" | "D" | "F"; weighted: number }) {
  const colorMap: Record<typeof grade, string> = {
    A: "var(--color-success)",
    B: "var(--color-accent)",
    C: "var(--color-warn)",
    D: "var(--color-warn)",
    F: "var(--color-danger)",
  };
  const color = colorMap[grade];
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ border: `1.5px solid ${color}`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)]">
        Schema grade
      </span>
      <span className="font-mono text-base font-bold" style={{ color }}>
        {grade}
      </span>
      <span className="font-mono text-[11px]" style={{ color }}>
        {Math.round(weighted * 100)}%
      </span>
    </div>
  );
}

type AnalysisTone = "ok" | "warn" | "danger" | "neutral";

function AnalysisCard({
  tone,
  title,
  status,
  body,
  source,
}: {
  tone: AnalysisTone;
  title: string;
  status: string;
  body: string;
  source?: string;
}) {
  const accent =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : "var(--color-line-strong)";
  return (
    <div
      className="border bg-[color:var(--color-bg-1)] p-4 flex flex-col gap-2 rounded"
      style={{ borderColor: accent }}
    >
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        {title}
      </div>
      <div className="font-mono text-[14px] font-medium" style={{ color: accent }}>
        {status}
      </div>
      <div className="text-[12.5px] leading-relaxed text-[color:var(--color-fg-dim)]">
        {body}
      </div>
      {source && (
        <div className="mt-auto font-mono text-[10px] tracking-[0.04em] text-[color:var(--color-fg-faint)] italic">
          {source}
        </div>
      )}
    </div>
  );
}

function SchemaFieldDetails({ aggregates }: { aggregates: TapeAggregates }) {
  const detected = aggregates.schema.byCanonical;
  // Group canonical fields by category
  const byCategory = new Map<FieldCategory, typeof CANONICAL_FIELDS>();
  for (const field of CANONICAL_FIELDS) {
    if (!byCategory.has(field.category)) byCategory.set(field.category, []);
    byCategory.get(field.category)!.push(field);
  }

  return (
    <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 space-y-5">
      {Array.from(byCategory.entries()).map(([cat, fields]) => (
        <div key={cat}>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            {categoryLabel(cat)}
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            {fields.map((f) => {
              const match = detected.get(f.name);
              const isDetected = !!match;
              const criticalityColor =
                f.criticality === "reg_f_minimum"
                  ? "var(--color-danger)"
                  : f.criticality === "critical"
                  ? "var(--color-warn)"
                  : "var(--color-fg-faint)";
              return (
                <div key={f.name} className="flex items-baseline gap-2 font-mono text-[11px]">
                  <span
                    className="w-3 text-center shrink-0"
                    style={{ color: isDetected ? "var(--color-success)" : criticalityColor }}
                  >
                    {isDetected ? "✓" : f.criticality === "reg_f_minimum" || f.criticality === "critical" ? "✗" : "○"}
                  </span>
                  <span className="text-[color:var(--color-fg-dim)] flex-1 truncate" title={f.description}>
                    {f.label}
                  </span>
                  {isDetected && match && (
                    <span className="text-[color:var(--color-fg-faint)] truncate max-w-[14ch]" title={match.header}>
                      ← {match.header}
                    </span>
                  )}
                  {!isDetected && f.criticality === "reg_f_minimum" && (
                    <span className="text-[color:var(--color-danger)] text-[10px]">REG F</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {aggregates.schema.unmappedHeaders.length > 0 && (
        <div className="pt-3 border-t border-[color:var(--color-line)]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Unmapped headers ({aggregates.schema.unmappedHeaders.length})
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {aggregates.schema.unmappedHeaders.map((h) => (
              <span
                key={h}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-[color:var(--color-bg-2)] text-[color:var(--color-fg-dim)] border border-[color:var(--color-line)]"
              >
                {h}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] italic">
            These headers exist in the tape but don't match the canonical schema. Often legitimate
            seller-specific fields; sometimes typos or asset-class-specific extensions. Future
            versions of the decoder will learn these and expand the schema.
          </div>
        </div>
      )}
    </div>
  );
}

function categoryLabel(cat: FieldCategory): string {
  const map: Record<FieldCategory, string> = {
    account_identity: "Account identity",
    consumer_identity: "Consumer identity",
    consumer_contact: "Consumer contact",
    balance_financial: "Balance / financial",
    dates: "Dates",
    debt_characteristics: "Debt characteristics",
    prior_collection: "Prior collection",
    chain_of_custody: "Chain of custody",
    scrub_status: "Scrub status",
    original_creditor: "Original creditor",
  };
  return map[cat];
}

function shortConventionLabel(c: BalanceConvention): string {
  switch (c) {
    case "exclude_post_co_interest_and_fees":
      return "Principal-only (Spiegel-style)";
    case "include_pre_co_interest_and_fees":
      return "Incl. pre-CO interest (CompuCredit-style)";
    case "include_post_co_interest_judgments_only":
      return "Incl. post-CO interest (judgments)";
    case "unknown":
      return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// SOL REPORT SECTION — per-account statute-of-limitations analysis with
// cliff queue export. The single most operationally valuable feature for a
// debt buyer because it tells you which accounts to chase FIRST (those
// about to lapse) and which to discount in the bid (those already lapsed).
// ---------------------------------------------------------------------------

function SolReportSection({
  report,
  totalFaceValue,
  filename,
}: {
  report: SolReport;
  totalFaceValue: number;
  filename: string | null;
}) {
  const lapsedPct = totalFaceValue > 0 ? (report.lapsedFaceValue / totalFaceValue) * 100 : 0;
  const cliff90Pct = totalFaceValue > 0 ? (report.cliff90FaceValue / totalFaceValue) * 100 : 0;
  const healthyPct =
    totalFaceValue > 0 ? (report.byStatus.healthy.faceValue / totalFaceValue) * 100 : 0;
  const unknownPct =
    report.totalAccountsAnalyzed > 0
      ? (report.byStatus.unknown.count / report.totalAccountsAnalyzed) * 100
      : 0;

  // CSV download — privacy-preserving (row index + state + SOL metadata only)
  function downloadCliffQueue() {
    const csv = cliffQueueToCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = (filename || "tape").replace(/\.[^.]+$/, "");
    a.download = `${baseName}__sol-cliff-queue.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const cliffCount =
    report.byStatus.lapsed.count + report.byStatus.cliff_30.count + report.byStatus.cliff_90.count + report.byStatus.cliff_180.count;
  const anchorMixSummary = describeAnchorMix(report);

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · Statute-of-limitations report</SectionLabel>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            {report.totalAccountsAnalyzed.toLocaleString()} accounts analyzed
          </span>
          {cliffCount > 0 && (
            <button
              type="button"
              onClick={downloadCliffQueue}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              ↓ Cliff queue CSV ({cliffCount.toLocaleString()})
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-3xl">
        Per-account SOL computed from state × debt type × last-payment date (50-state matrix). Lapsed
        accounts are uncollectable by suit — discount face accordingly. Cliff accounts (≤90 days) go
        to the top of the outreach queue.
      </p>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
        <SolStat
          label="Lapsed"
          count={report.byStatus.lapsed.count}
          faceValue={report.byStatus.lapsed.faceValue}
          tone="danger"
          sub={`${lapsedPct.toFixed(1)}% of face`}
        />
        <SolStat
          label="Cliff ≤ 90 days"
          count={report.byStatus.cliff_30.count + report.byStatus.cliff_90.count}
          faceValue={report.cliff90FaceValue}
          tone="warn"
          sub={`${cliff90Pct.toFixed(1)}% of face`}
        />
        <SolStat
          label="Cliff 91–180"
          count={report.byStatus.cliff_180.count}
          faceValue={report.byStatus.cliff_180.faceValue}
          tone="warn-soft"
        />
        <SolStat
          label="Healthy"
          count={report.byStatus.healthy.count}
          faceValue={report.byStatus.healthy.faceValue}
          tone="ok"
          sub={`${healthyPct.toFixed(1)}% of face`}
        />
      </div>

      {/* Headline recommendation */}
      <div
        className="mt-5 rounded-lg p-4"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
          What this means for your bid
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
          {report.lapsedFaceValue > 0 && (
            <li>
              <strong className="text-[color:var(--color-danger)]">
                {formatUSD(report.lapsedFaceValue)} ({lapsedPct.toFixed(1)}%)
              </strong>{" "}
              of face is already past SOL — uncollectable by suit. Bid as soft-collect-only paper or
              discount it from your face computation entirely.
            </li>
          )}
          {report.cliff90FaceValue > 0 && (
            <li>
              <strong className="text-[color:var(--color-warn)]">
                {formatUSD(report.cliff90FaceValue)} ({cliff90Pct.toFixed(1)}%)
              </strong>{" "}
              within 90 days of SOL — work these FIRST after close. Cliff queue CSV gives you the
              row indices to filter your tape.
            </li>
          )}
          {report.cliff90FaceValue === 0 && report.lapsedFaceValue === 0 && (
            <li>
              No statute-cliff exposure — tape is operationally healthy on SOL. Pursue collections
              and litigation on standard timelines.
            </li>
          )}
        </ul>
        {anchorMixSummary && (
          <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] italic">
            {anchorMixSummary}
          </p>
        )}
        {unknownPct >= 20 && (
          <p className="mt-2 text-[11px] text-[color:var(--color-warn)]">
            ⚠ {unknownPct.toFixed(0)}% of accounts had insufficient data to compute SOL — the
            healthy/lapsed counts above are conservative. Request supplemental dates from the seller.
          </p>
        )}
        <p className="mt-2 text-[10px] font-mono text-[color:var(--color-fg-faint)]">
          Compliance signal, not legal advice. State-specific tolling, partial-payment revival, and
          choice-of-law rules apply. Have counsel verify before litigation or time-bar disclosures.
        </p>
      </div>
    </section>
  );
}

function SolStat({
  label,
  count,
  faceValue,
  tone,
  sub,
}: {
  label: string;
  count: number;
  faceValue: number;
  tone: "danger" | "warn" | "warn-soft" | "ok";
  sub?: string;
}) {
  const color =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "warn-soft"
      ? "var(--color-fg-dim)"
      : "var(--color-success)";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl tick" style={{ color }}>
        {count.toLocaleString()}
      </div>
      <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-dim)]">
        {formatUSD(faceValue)}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LICENSE COVERAGE SECTION — operator declares which states they're
// licensed to collect in; decoder shows which slice of the tape they cannot
// legally pursue. Combined with SOL, this is "what's this tape WORTH TO ME
// SPECIFICALLY" rather than "what's this tape's headline face."
// ---------------------------------------------------------------------------

function LicenseCoverageSection({
  effective,
  policy,
  onPolicyChange,
  stateDistribution,
}: {
  effective: EffectiveLicenseMap;
  policy: LicensePolicy | null;
  onPolicyChange: (p: LicensePolicy) => void;
  stateDistribution: Array<{ state: string; count: number; faceValue: number }>;
}) {
  const [editing, setEditing] = useState(false);
  const impact = computeLicenseImpact(effective, stateDistribution);
  const configured = effective.source !== "none";
  const fromComplianceBoard = effective.source === "compliance_board";

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · License coverage</SectionLabel>
        {configured && (
          <div className="flex items-center gap-2">
            {fromComplianceBoard ? (
              <a
                href="/app/compliance"
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
              >
                Source: /app/compliance ({effective.rawLicenseCount} active) · edit →
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
              >
                {editing ? "Cancel" : `Edit (${effective.licensedStates.length} states)`}
              </button>
            )}
          </div>
        )}
      </div>

      {editing && !fromComplianceBoard && (
        <LicensePolicyEditor
          initial={policy}
          onSave={(p) => {
            onPolicyChange(p);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && !configured && (
        <div
          className="mt-4 rounded-lg p-5"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Configure your license map
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            Tell us which states you're licensed to collect in. Every future tape will show how
            much face value falls in unlicensed states — that's face value you can't legally
            pursue and shouldn't be paying full price for.
          </p>
          <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
            For full license tracking (expiration dates, bond amounts, surety carriers, renewal
            alerts), use <a href="/app/compliance" className="underline hover:text-[color:var(--color-accent)]">/app/compliance</a>. The quick editor below is a faster path for ops who just need state coverage now.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded text-[#0a0c14] hover:opacity-90 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              Quick configure →
            </button>
            <a
              href="/app/compliance"
              className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 transition"
            >
              Full tracking at /app/compliance →
            </a>
          </div>
        </div>
      )}

      {!editing && configured && (
        <LicenseImpactCard
          impact={impact}
          fromComplianceBoard={fromComplianceBoard}
          notes={effective.notes}
          lastUpdated={effective.lastUpdated}
        />
      )}
    </section>
  );
}

function LicensePolicyEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: LicensePolicy | null;
  onSave: (p: LicensePolicy) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.licensedStates ?? [])
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(ALL_US_STATES.map((s) => s.code)));
  }
  function clearAll() {
    setSelected(new Set());
  }
  function preselectNoLicenseRequired() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of NO_LICENSE_REQUIRED_STATES) next.add(c);
      return next;
    });
  }

  return (
    <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Select states where you hold all required licenses to collect third-party-purchased debt
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={preselectNoLicenseRequired}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            title="Preselect states that generally don't require a debt-buyer license (per public licensing guides)"
          >
            + No-license-req'd
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {ALL_US_STATES.map((s) => {
          const on = selected.has(s.code);
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => toggle(s.code)}
              className={`font-mono text-[11px] tracking-[0.05em] px-2.5 py-1.5 rounded text-left transition ${
                on
                  ? "border border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
              title={s.notes ?? s.name}
            >
              <span className="font-medium">{s.code}</span>
              <span className="ml-1 text-[10px] text-[color:var(--color-fg-faint)]">{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="block font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase mb-1">
          Notes (optional)
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. NY/MD verified Q2; CA pending renewal due 2026-08"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </label>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-[color:var(--color-fg-dim)]">
          {selected.size} state{selected.size === 1 ? "" : "s"} selected
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              licensedStates: Array.from(selected).sort(),
              lastUpdated: new Date().toISOString(),
              notes: notes.trim() || undefined,
            })
          }
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          Save policy
        </button>
      </div>
    </div>
  );
}

function LicenseImpactCard({
  impact,
  fromComplianceBoard,
  notes,
  lastUpdated,
}: {
  impact: LicenseImpact;
  fromComplianceBoard: boolean;
  notes?: string;
  lastUpdated?: string;
}) {
  const formatAgo = (iso: string | undefined): string => {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86_400_000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Expiring-soon urgent banner — only shown for compliance_board source */}
      {impact.coveredButExpiringSoon.length > 0 && (
        <div className="border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] p-4">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            License renewal urgent — covers this tape but expiring
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px] text-[color:var(--color-fg)]">
            {impact.coveredButExpiringSoon.map((s) => (
              <li key={s.state} className="flex items-baseline gap-3 font-mono">
                <span className="text-[color:var(--color-warn)] w-12 font-medium">{s.state}</span>
                <span className="flex-1">
                  expires in <strong>{s.daysToExpiry}d</strong> · {formatUSD(s.faceValue)} of this
                  tape depends on it
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[color:var(--color-fg-dim)]">
            Most states take 30–60 days to renew. Start the paperwork now.{" "}
            <a href="/app/compliance" className="underline hover:text-[color:var(--color-accent)]">
              /app/compliance →
            </a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
        <SolStat
          label="Licensed (collectable to you)"
          count={impact.coveredStates.reduce((s, e) => s + e.count, 0)}
          faceValue={impact.coveredFaceValue}
          tone="ok"
          sub={`${impact.coveredPct.toFixed(1)}% of tape face`}
        />
        <SolStat
          label="Unlicensed (face you can't pursue)"
          count={impact.uncoveredStates.reduce((s, e) => s + e.count, 0)}
          faceValue={impact.uncoveredFaceValue}
          tone={impact.uncoveredFaceValue > impact.coveredFaceValue * 0.1 ? "danger" : "warn-soft"}
          sub={`${impact.uncoveredPct.toFixed(1)}% of tape face`}
        />
        <SolStat
          label="States in tape / unlicensed"
          count={impact.uncoveredStates.length}
          faceValue={0}
          tone="warn-soft"
          sub={
            fromComplianceBoard
              ? `Source: /app/compliance`
              : `Simple policy · updated ${formatAgo(lastUpdated)}`
          }
        />
      </div>

      {impact.uncoveredStates.length > 0 && (
        <div className="border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            Unlicensed states in this tape
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
            These accounts are in states you haven't declared coverage for. Discount this face
            value from your bid math or pursue cooperative collection through a licensed servicer.
          </p>
          <ul className="mt-3 space-y-1.5">
            {impact.uncoveredStates.map((s) => (
              <li
                key={s.state}
                className="flex items-baseline gap-3 font-mono text-[12px]"
              >
                <span className="text-[color:var(--color-warn)] w-12 font-medium">{s.state}</span>
                <span className="text-[color:var(--color-fg-dim)] flex-1">
                  {s.stateName} · {s.count.toLocaleString()} accts ({s.facePct.toFixed(1)}%)
                </span>
                <span className="text-[color:var(--color-fg)] tick">{formatUSD(s.faceValue)}</span>
              </li>
            ))}
          </ul>
          {impact.uncoveredStates.some((s) => s.notes) && (
            <div className="mt-3 pt-3 border-t border-[color:var(--color-line)] space-y-1">
              {impact.uncoveredStates
                .filter((s) => s.notes)
                .map((s) => (
                  <p
                    key={s.state}
                    className="text-[11px] text-[color:var(--color-fg-faint)] italic"
                  >
                    <span className="font-mono text-[color:var(--color-warn)]">{s.state}:</span>{" "}
                    {s.notes}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {impact.uncoveredStates.length === 0 && impact.totalFaceAnalyzed > 0 && (
        <div className="border border-[color:var(--color-success)] bg-[color:var(--color-bg-1)] p-4">
          <p className="text-[13px] text-[color:var(--color-success)] leading-relaxed">
            ✓ Fully covered — every state in this tape is in your declared license map. No
            license-driven face-value discount required.
          </p>
        </div>
      )}

      {notes && (
        <p className="text-[11px] text-[color:var(--color-fg-faint)] font-mono italic">
          Notes: {notes}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONCENTRATION SECTION — operator declares max % per state/vintage/asset
// class. Decoder shows whether the tape alone breaches those limits, by
// dimension and severity. V1 is tape-alone; V2 will join the operator's
// existing book for true combined-exposure checks.
// ---------------------------------------------------------------------------

function ConcentrationSection({
  policy,
  onPolicyChange,
  aggregates,
}: {
  policy: ConcentrationPolicy | null;
  onPolicyChange: (p: ConcentrationPolicy) => void;
  aggregates: TapeAggregates;
}) {
  const [editing, setEditing] = useState(false);
  const report = computeConcentrationReport(policy, aggregates);

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · Concentration limits</SectionLabel>
        {policy && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            {editing ? "Cancel" : `Edit (state ${policy.maxPctPerState ?? "—"}% · vintage ${policy.maxPctPerVintage ?? "—"}% · asset ${policy.maxPctPerAssetClass ?? "—"}%)`}
          </button>
        )}
      </div>

      {editing && (
        <ConcentrationPolicyEditor
          initial={policy ?? DEFAULT_CONCENTRATION_POLICY}
          onSave={(p) => {
            onPolicyChange(p);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && !policy && (
        <div className="mt-4 rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Set concentration limits to flag breaches
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Declare max % exposure per state, vintage year, and asset class. Every tape decode
            checks against these limits and flags breaches before you bid. Top concentrations in
            this tape:
          </p>
          <ul className="mt-3 space-y-1 text-[12px] font-mono text-[color:var(--color-fg-dim)]">
            {report.topByDimension.state && (
              <li>
                Top state:{" "}
                <span className="text-[color:var(--color-fg)]">
                  {report.topByDimension.state.key}
                </span>{" "}
                · {report.topByDimension.state.pct.toFixed(1)}% ({formatUSD(report.topByDimension.state.faceValue)})
              </li>
            )}
            {report.topByDimension.vintage && (
              <li>
                Top vintage:{" "}
                <span className="text-[color:var(--color-fg)]">
                  {report.topByDimension.vintage.key}
                </span>{" "}
                · {report.topByDimension.vintage.pct.toFixed(1)}% ({formatUSD(report.topByDimension.vintage.faceValue)})
              </li>
            )}
            {report.topByDimension.asset_class && (
              <li>
                Top asset class:{" "}
                <span className="text-[color:var(--color-fg)]">
                  {report.topByDimension.asset_class.key}
                </span>{" "}
                · {report.topByDimension.asset_class.pct.toFixed(1)}% ({formatUSD(report.topByDimension.asset_class.faceValue)})
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 transition"
          >
            Set concentration limits →
          </button>
        </div>
      )}

      {!editing && policy && <ConcentrationBreachCard report={report} policy={policy} />}
    </section>
  );
}

function ConcentrationPolicyEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ConcentrationPolicy;
  onSave: (p: ConcentrationPolicy) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<string>(initial.maxPctPerState?.toString() ?? "");
  const [vintage, setVintage] = useState<string>(initial.maxPctPerVintage?.toString() ?? "");
  const [asset, setAsset] = useState<string>(initial.maxPctPerAssetClass?.toString() ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  function parseLimit(s: string): number | null {
    const v = s.trim();
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
    return n;
  }

  return (
    <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        Concentration limits (% of total face value)
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
        Enter max % exposure per dimension. Blank = no limit on that dimension. Defaults reflect
        typical hedge-fund / SBIC policy memos.
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <SmallInput label="Max % per state" value={state} onChange={setState} placeholder="25" type="number" />
        <SmallInput label="Max % per vintage" value={vintage} onChange={setVintage} placeholder="35" type="number" />
        <SmallInput label="Max % per asset class" value={asset} onChange={setAsset} placeholder="60" type="number" />
      </div>
      <label className="mt-4 block">
        <span className="block font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase mb-1">
          Notes (optional)
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Per LP policy memo Q1 2026 — no medical >40%"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </label>
      <div className="mt-4 flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              maxPctPerState: parseLimit(state),
              maxPctPerVintage: parseLimit(vintage),
              maxPctPerAssetClass: parseLimit(asset),
              notes: notes.trim() || undefined,
              lastUpdated: new Date().toISOString(),
            })
          }
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          Save policy
        </button>
      </div>
    </div>
  );
}

function ConcentrationBreachCard({
  report,
  policy,
}: {
  report: ConcentrationReport;
  policy: ConcentrationPolicy;
}) {
  if (report.breaches.length === 0) {
    return (
      <div className="mt-4 border border-[color:var(--color-success)] bg-[color:var(--color-bg-1)] p-4">
        <p className="text-[13px] text-[color:var(--color-success)] leading-relaxed">
          ✓ No concentration breaches — this tape fits within your declared limits (state ≤
          {policy.maxPctPerState ?? "—"}%, vintage ≤{policy.maxPctPerVintage ?? "—"}%, asset ≤
          {policy.maxPctPerAssetClass ?? "—"}%).
        </p>
        {policy.notes && (
          <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] font-mono italic">
            Notes: {policy.notes}
          </p>
        )}
      </div>
    );
  }

  const severeCount = report.breaches.filter((b) => b.severity === "severe").length;
  const tone =
    severeCount > 0
      ? "var(--color-danger)"
      : report.breaches.some((b) => b.severity === "moderate")
      ? "var(--color-warn)"
      : "var(--color-warn-soft)";

  return (
    <div className="mt-4 border bg-[color:var(--color-bg-1)] p-5" style={{ borderColor: tone }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: tone }}>
          {report.breaches.length} concentration breach{report.breaches.length === 1 ? "" : "es"}
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
          policy: state ≤{policy.maxPctPerState ?? "—"}% · vintage ≤{policy.maxPctPerVintage ?? "—"}% · asset ≤{policy.maxPctPerAssetClass ?? "—"}%
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {report.breaches.map((b) => {
          const sevColor =
            b.severity === "severe"
              ? "var(--color-danger)"
              : b.severity === "moderate"
              ? "var(--color-warn)"
              : "var(--color-fg-dim)";
          return (
            <li
              key={`${b.dimension}:${b.key}`}
              className="flex items-baseline gap-3 font-mono text-[12px]"
            >
              <span
                className="px-1.5 py-0.5 rounded text-[10px] tracking-[0.05em] shrink-0"
                style={{ background: sevColor, color: "var(--color-bg)" }}
              >
                {b.severity.toUpperCase()}
              </span>
              <span className="text-[color:var(--color-fg-dim)] w-24 shrink-0">
                {b.dimension.replace("_", " ")}
              </span>
              <span className="text-[color:var(--color-accent)] font-medium">{b.key}</span>
              <span className="flex-1 text-[color:var(--color-fg-dim)]">
                {b.pct.toFixed(1)}% (limit {b.limit}%) · over by {(b.pct - b.limit).toFixed(1)} pts
              </span>
              <span className="text-[color:var(--color-fg)] tick">{formatUSD(b.faceValue)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] italic">
        V1 checks this tape alone. V2 will join your existing book (Portfolio module) for true
        combined-exposure breaches.
      </p>
      {policy.notes && (
        <p className="mt-1 text-[11px] text-[color:var(--color-fg-faint)] font-mono italic">
          Notes: {policy.notes}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOUBLE-SOLD DETECTION SECTION — cross-tape match check. Per-account
// hashing happens in the parent useEffect; this component renders the
// match results + fingerprint history management. Privacy-preserving:
// only hashes are stored, only row indices are exported.
// ---------------------------------------------------------------------------

function DoubleSoldSection({
  report,
  accounts,
  loading,
  priorFingerprints,
  filename,
  onClearAll,
  onDeleteTape,
}: {
  report: DoubleSoldReport | null;
  accounts: NewTapeAccount[];
  loading: boolean;
  priorFingerprints: StoredTapeFingerprint[];
  filename: string | null;
  onClearAll: () => void;
  onDeleteTape: (tapeId: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  function downloadMatchedRows() {
    if (!report) return;
    const csv = matchedRowsCsv(report, accounts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = (filename || "tape").replace(/\.[^.]+$/, "");
    a.download = `${baseName}__double-sold-matches.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · Cross-tape match check</SectionLabel>
        <button
          type="button"
          onClick={() => setShowHistory((s) => !s)}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          {showHistory ? "Hide" : `History (${priorFingerprints.length} tape${priorFingerprints.length === 1 ? "" : "s"} saved)`}
        </button>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-3xl">
        Detects when an account on this tape was already on a previous tape you decoded — the
        #1 unflagged risk in the secondary market. Per-account hashes (no PII) are stored in
        your browser only; matches surface row indices, not consumer identifiers.
      </p>

      {loading && (
        <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-4 text-[13px] text-[color:var(--color-fg-dim)] rounded">
          Hashing accounts and checking against {priorFingerprints.length} prior tape{priorFingerprints.length === 1 ? "" : "s"}…
        </div>
      )}

      {!loading && report === null && (
        <div className="mt-4 border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-4 text-[12.5px] text-[color:var(--color-fg-dim)] rounded">
          No account-number / DOB / SSN column detected — cross-tape fingerprinting requires at
          least one identity anchor. Add a tape with an account-number column to enable this
          check.
        </div>
      )}

      {!loading && report && report.totalMatchedAccounts === 0 && report.priorTapesChecked === 0 && (
        <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4 rounded">
          <div className="flex items-center gap-2 flex-wrap text-[13px]">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              First tape saved
            </span>
            <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-[200px]">
              Fingerprinted {report.newTapeHashCount.toLocaleString()} accounts and saved them
              for future cross-tape checks. Decode another tape from a different seller — if any
              accounts overlap, they'll be flagged here.
            </span>
          </div>
        </div>
      )}

      {!loading && report && report.totalMatchedAccounts === 0 && report.priorTapesChecked > 0 && (
        <div className="mt-4 border border-[color:var(--color-success)] bg-[color:var(--color-bg-1)] p-4 rounded">
          <p className="text-[13px] text-[color:var(--color-success)] leading-relaxed">
            ✓ No double-sold accounts found. Checked {report.newTapeHashCount.toLocaleString()}{" "}
            new-tape accounts against {report.priorTapesChecked} prior tape{report.priorTapesChecked === 1 ? "" : "s"}{" "}
            in your history.
          </p>
        </div>
      )}

      {!loading && report && report.totalMatchedAccounts > 0 && (
        <div className="mt-4 space-y-4">
          {/* Headline */}
          <div
            className="rounded-lg p-5"
            style={{
              background:
                "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
              border: "1.5px solid transparent",
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-danger)]">
                  Double-sold risk detected
                </div>
                <h3 className="mt-1 font-semibold text-xl text-[color:var(--color-fg)]">
                  {report.totalMatchedAccounts.toLocaleString()} account
                  {report.totalMatchedAccounts === 1 ? "" : "s"} on this tape match{" "}
                  {report.matches.length} prior tape{report.matches.length === 1 ? "" : "s"}.
                </h3>
                <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
                  <strong className="text-[color:var(--color-danger)]">
                    {formatUSD(report.matchedFaceValueInNewTape)}
                  </strong>{" "}
                  ({((report.matchedFaceValueInNewTape / report.totalFaceValueInNewTape) * 100).toFixed(1)}%
                  of this tape's face) was already in your previously-decoded tapes — discount
                  from your bid or demand the seller remove them.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadMatchedRows}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                ↓ Matched rows CSV
              </button>
            </div>
          </div>

          {/* Per-prior-tape breakdown */}
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 rounded">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Overlap with prior tapes
            </div>
            <ul className="mt-3 space-y-1.5">
              {report.matches.map((m) => (
                <li key={m.priorTapeId} className="flex items-baseline gap-3 font-mono text-[12px]">
                  <span className="text-[color:var(--color-danger)] tabular-nums w-12 shrink-0">
                    {m.matchedHashCount}
                  </span>
                  <span className="text-[color:var(--color-fg)] flex-1 truncate min-w-0">
                    {m.priorTapeFileName}
                  </span>
                  <span className="text-[color:var(--color-fg-dim)] shrink-0 tabular-nums">
                    {m.overlapPctOfNew.toFixed(1)}% of new · {m.overlapPctOfPrior.toFixed(1)}% of prior
                  </span>
                  <span className="text-[color:var(--color-fg-faint)] text-[10px] shrink-0 tabular-nums">
                    saved {new Date(m.priorTapeCreatedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* HISTORY PANEL */}
      {showHistory && (
        <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 rounded">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
                Saved tape fingerprints
              </div>
              <p className="mt-1 text-[11.5px] text-[color:var(--color-fg-dim)] leading-snug">
                Only hashes (no PII) are stored. Older tapes evict automatically once total
                stored hashes exceed 100k.
              </p>
            </div>
            {priorFingerprints.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] transition"
              >
                Clear all
              </button>
            )}
          </div>
          {priorFingerprints.length === 0 ? (
            <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)]">
              No tapes fingerprinted yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {priorFingerprints.map((t) => (
                <li key={t.tapeId} className="flex items-baseline gap-3 font-mono text-[11.5px]">
                  <span className="text-[color:var(--color-accent)] flex-1 truncate min-w-0">
                    {t.fileName}
                  </span>
                  <span className="text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
                    {t.hashCount.toLocaleString()} accounts
                  </span>
                  <span className="text-[color:var(--color-fg-faint)] text-[10px] tabular-nums shrink-0">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteTape(t.tapeId)}
                    className="font-mono text-[10px] text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-danger)] transition shrink-0"
                    title="Delete this fingerprint"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report && report.priorTapesChecked > 0 && (
        <p className="mt-3 text-[10px] font-mono text-[color:var(--color-fg-faint)] italic">
          V1 uses exact hash matching per-operator. V2 will add bloom-filter compression and
          federated cross-operator matching (opt-in, anonymized) once N≥10 operators are on rails.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SERVICER MATCH — at decision time, rank the operator's roster of
// placement servicers by predicted recovery on this tape's profile.
// Reads holdings + collections from localStorage; matches by asset class.
// ---------------------------------------------------------------------------

function ServicerMatchSection({
  tapeAssetClass,
  tapeFaceValue,
  tapeVintageYear,
}: {
  tapeAssetClass: string;
  tapeFaceValue: number;
  tapeVintageYear?: number;
}) {
  const [report, setReport] = useState<ServicerMatchReport | null>(null);

  useEffect(() => {
    try {
      const holdingsRaw = window.localStorage.getItem("tradeline.portfolio.holdings.v1");
      const holdings: MatcherHolding[] = (holdingsRaw ? JSON.parse(holdingsRaw) || [] : []).map(
        (h: {
          id?: string;
          servicer?: string;
          assetClass?: string;
          faceValueUsd?: number;
          purchasePriceUsd?: number;
          vintageYear?: number;
          purchaseDate?: string;
        }, i: number) => ({
          id: String(h.id ?? `h${i}`),
          servicer: String(h.servicer ?? ""),
          assetClass: String(h.assetClass ?? ""),
          faceValueUsd: Number(h.faceValueUsd) || 0,
          purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
          vintageYear: Number(h.vintageYear) || undefined,
          purchaseDate: String(h.purchaseDate ?? ""),
        })
      );
      const collections: HoldingCollections[] = readCollections();
      const r = matchServicersForTape(
        { assetClass: tapeAssetClass, faceValueUsd: tapeFaceValue, vintageYear: tapeVintageYear },
        holdings,
        collections
      );
      setReport(r);
    } catch {
      setReport(null);
    }
  }, [tapeAssetClass, tapeFaceValue, tapeVintageYear]);

  if (!report) return null;

  // Cold-start: industry benchmark fallback (when no servicer history)
  if (report.isColdStart) {
    return (
      <div className="mt-4 border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-4 rounded">
        <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Servicer match
          </span>
          <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-[200px]">
            {report.headline}
          </span>
          {report.totalServicersInBook === 0 && (
            <a
              href="/app/portfolio"
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
            >
              Log placements →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-lg p-4"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Servicer match
          </span>
          {report.topRecommendation && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.05em] uppercase"
              style={{
                background: confidenceColor(report.topRecommendation.confidence),
                color: "var(--color-bg)",
              }}
            >
              {report.topRecommendation.confidence} confidence
            </span>
          )}
        </div>
        <a
          href="/app/portfolio"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Full performance at /app/portfolio →
        </a>
      </div>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
        {report.headline}
      </p>

      {/* Ranked list */}
      <div className="mt-3 space-y-1.5">
        {report.matches.map((m) => (
          <ServicerRow key={m.servicer} m={m} isTop={m.rank === 1} />
        ))}
      </div>

      {/* Industry benchmark — always shown as a sanity check */}
      {report.industryBenchmark && (
        <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] italic">
          Industry benchmark: {report.industryBenchmark.medianRecoveryCentsPerFaceDollar.toFixed(1)}¢/$ of face
          (~{formatUSD(report.industryPredictedRecoveryUsd)} predicted gross) ·{" "}
          {report.industryBenchmark.note}.
        </p>
      )}
    </div>
  );
}

function confidenceColor(c: ServicerMatchReport["matches"][number]["confidence"]): string {
  switch (c) {
    case "high":
      return "var(--color-success)";
    case "medium":
      return "var(--color-accent)";
    case "low":
      return "var(--color-warn)";
    case "cold_start":
    default:
      return "var(--color-fg-faint)";
  }
}

function ServicerRow({
  m,
  isTop,
}: {
  m: ServicerMatchReport["matches"][number];
  isTop: boolean;
}) {
  const borderColor = isTop ? "var(--color-accent)" : "var(--color-line)";
  return (
    <div
      className="rounded border bg-[color:var(--color-bg)] p-3"
      style={{ borderColor }}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-[0.05em] font-semibold shrink-0"
          style={{
            background: isTop ? "var(--color-accent)" : "var(--color-fg-faint)",
            color: "var(--color-bg)",
          }}
        >
          #{m.rank}
        </span>
        <span className="font-mono text-[13px] text-[color:var(--color-accent)] shrink-0">
          {m.servicer}
        </span>
        <span className="text-[12px] text-[color:var(--color-fg-dim)] flex-1 truncate min-w-0">
          {m.matchedHoldings} matching holding{m.matchedHoldings === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
          realized {m.medianRealizedCentsPerDollar.toFixed(1)}¢/$ on cost
        </span>
        <span className="font-mono text-[12px] tabular-nums shrink-0" style={{ color: isTop ? "var(--color-accent)" : "var(--color-fg)" }}>
          predicted {formatUSD(m.predictedRecoveryUsdGross)}
        </span>
      </div>
      {m.notes.length > 0 && (
        <p className="mt-1.5 text-[11px] text-[color:var(--color-fg-faint)] italic leading-snug">
          {m.notes.join(" · ")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMP-SET CALLOUT — Tape Copilot's inline comp-set bridge. Reads holdings +
// deals from localStorage; if N≥3 similar comps, shows operator's own
// historical bid range as a counterpoint to the industry preset. Cold-start
// renders a quiet hint to build comp depth.
// ---------------------------------------------------------------------------

function CompSetCallout({
  assetClass,
  faceValueUsd,
  vintageYear,
  disciplinedBidCentsPerDollar,
}: {
  assetClass: string;
  faceValueUsd: number;
  vintageYear?: number;
  disciplinedBidCentsPerDollar: number;
}) {
  const [report, setReport] = useState<CompSetReport | null>(null);

  useEffect(() => {
    try {
      const holdingsRaw = window.localStorage.getItem("tradeline.portfolio.holdings.v1");
      const dealsRaw = window.localStorage.getItem("tradeline.pipeline.deals.v1");
      const holdings = (holdingsRaw ? JSON.parse(holdingsRaw) || [] : []).map(
        (h: {
          id?: string;
          assetClass?: string;
          faceValueUsd?: number;
          purchasePriceUsd?: number;
          vintageYear?: number;
          purchaseDate?: string;
          cumulativeCollectedUsd?: number;
        }, i: number) => ({
          id: h.id ?? `h${i}`,
          assetClass: h.assetClass ?? "Unspecified",
          faceValueUsd: Number(h.faceValueUsd) || 0,
          purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
          vintageYear: Number(h.vintageYear) || undefined,
          purchaseDate: h.purchaseDate ?? "",
          cumulativeCollectedUsd:
            typeof h.cumulativeCollectedUsd === "number"
              ? h.cumulativeCollectedUsd
              : undefined,
        })
      );
      const deals = (dealsRaw ? JSON.parse(dealsRaw) || [] : []).map(
        (d: {
          id?: string;
          assetClass?: string;
          faceValueUsd?: number;
          bidCentsPerDollar?: number;
          askCentsPerDollar?: number;
          stage?: string;
        }, i: number) => ({
          id: d.id ?? `d${i}`,
          assetClass: d.assetClass ?? "Unspecified",
          faceValueUsd: Number(d.faceValueUsd) || 0,
          bidCentsPerDollar:
            typeof d.bidCentsPerDollar === "number" ? d.bidCentsPerDollar : undefined,
          askCentsPerDollar:
            typeof d.askCentsPerDollar === "number" ? d.askCentsPerDollar : undefined,
          stage: d.stage as "sourced" | "reviewing" | "underwriting" | "bidding" | "won" | "lost" | "walked",
        })
      );
      setReport(
        computeCompSet(
          { assetClass, faceValueUsd, vintageYear },
          holdings,
          deals
        )
      );
    } catch {
      setReport(null);
    }
  }, [assetClass, faceValueUsd, vintageYear]);

  if (!report) return null;

  // Cold-start: quiet hint
  if (report.confidence === "cold_start") {
    return (
      <div className="mt-4 border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-3 rounded">
        <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Comp set
          </span>
          <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-[200px]">
            Only {report.totalMatches} similar comp{report.totalMatches === 1 ? "" : "s"} in your
            history — using industry defaults below. Comp-set pricing activates at N≥3.
          </span>
          <a
            href={`/app/tools/bid-calculator?face=${faceValueUsd}&assetClass=${encodeURIComponent(assetClass)}`}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            Comp panel →
          </a>
        </div>
      </div>
    );
  }

  if (!report.bidStats || report.recommendedBidCentsPerDollar === null) return null;

  const compMedian = report.recommendedBidCentsPerDollar;
  const delta = compMedian - disciplinedBidCentsPerDollar;
  const deltaPct = disciplinedBidCentsPerDollar > 0
    ? (delta / disciplinedBidCentsPerDollar) * 100
    : 0;
  const tone = Math.abs(deltaPct) < 10 ? "ok" : Math.abs(deltaPct) < 30 ? "warn" : "danger";
  const toneColor =
    tone === "ok" ? "var(--color-success)" : tone === "warn" ? "var(--color-warn)" : "var(--color-danger)";
  const confColor =
    report.confidence === "high"
      ? "var(--color-success)"
      : report.confidence === "medium"
      ? "var(--color-accent)"
      : "var(--color-warn)";

  return (
    <div
      className="mt-4 rounded-lg p-4"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Your comp set
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.05em] uppercase"
            style={{ background: confColor, color: "var(--color-bg)" }}
          >
            {report.confidence} confidence · n={report.totalMatches}
          </span>
        </div>
        <a
          href={`/app/tools/bid-calculator?face=${faceValueUsd}&assetClass=${encodeURIComponent(assetClass)}${vintageYear ? `&vintage=${vintageYear}` : ""}`}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Full panel →
        </a>
      </div>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
        On {report.totalMatches} similar past tapes you bid{" "}
        <strong className="font-mono text-[color:var(--color-accent)]">
          {compMedian.toFixed(2)}¢/$
        </strong>{" "}
        median (range {report.bidStats.p25.toFixed(2)}–{report.bidStats.p75.toFixed(2)}).
        {report.realizedStats && (
          <>
            {" "}Realized{" "}
            <strong className="font-mono text-[color:var(--color-success)]">
              {report.realizedStats.medianMultiple.toFixed(2)}×
            </strong>{" "}
            multiple ({(report.realizedStats.medianCagr * 100).toFixed(0)}% CAGR).
          </>
        )}
        {report.winRate !== null && (
          <>
            {" "}Win rate: {(report.winRate * 100).toFixed(0)}%.
          </>
        )}
      </p>
      <p className="mt-2 text-[12.5px]" style={{ color: toneColor }}>
        Industry-preset disciplined bid: <strong>{disciplinedBidCentsPerDollar.toFixed(2)}¢/$</strong>
        {" "}· Your history says <strong>{compMedian.toFixed(2)}¢/$</strong>
        {" "}({delta >= 0 ? "+" : ""}{deltaPct.toFixed(0)}%).
        {Math.abs(deltaPct) >= 20 && (
          <>
            {" "}Material delta — your realized data is the better calibration than industry defaults.
          </>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CAPITAL IMPACT — inline projection of what bidding this tape at the
// disciplined price would do to the operator's book. Pulls capital state +
// portfolio asset-class composition from localStorage and runs the same
// math the /app/capital bid envelope uses, scoped to THIS tape's bid.
// ---------------------------------------------------------------------------

function CapitalImpactInline({
  disciplinedBidDollars,
  disciplinedBidCentsPerDollar,
  tapeFaceValue,
  tapeAssetClass,
  concentrationPolicy,
}: {
  disciplinedBidDollars: number;
  disciplinedBidCentsPerDollar: number;
  tapeFaceValue: number;
  tapeAssetClass: string;
  concentrationPolicy: ConcentrationPolicy | null;
}) {
  const [available, setAvailable] = useState<number | null>(null);
  const [currentAssetFace, setCurrentAssetFace] = useState(0);
  const [totalAssetFace, setTotalAssetFace] = useState(0);

  useEffect(() => {
    // Capital state
    try {
      const raw = window.localStorage.getItem("tradeline.capital.config.v1");
      const totalParsed = raw ? Number(JSON.parse(raw)?.totalCapitalUsd) : 0;
      const total = Number.isFinite(totalParsed) && totalParsed > 0 ? totalParsed : 0;
      // Deployed
      const portfolioRaw = window.localStorage.getItem("tradeline.portfolio.holdings.v1");
      const portfolio: Array<{
        purchasePriceUsd?: number;
        faceValueUsd?: number;
        assetClass?: string;
      }> = portfolioRaw ? JSON.parse(portfolioRaw) || [] : [];
      const deployed = portfolio.reduce((s, h) => s + (Number(h.purchasePriceUsd) || 0), 0);
      // Committed bids
      const pipelineRaw = window.localStorage.getItem("tradeline.pipeline.deals.v1");
      const pipeline: Array<{
        stage?: string;
        faceValueUsd?: number;
        bidCentsPerDollar?: number;
      }> = pipelineRaw ? JSON.parse(pipelineRaw) || [] : [];
      const committed = pipeline
        .filter((d) => d.stage === "bidding")
        .reduce(
          (s, d) =>
            s +
            (Number(d.faceValueUsd) || 0) * ((Number(d.bidCentsPerDollar) || 0) / 100),
          0
        );
      setAvailable(total - deployed - committed);
      // Asset-class composition by face
      const totalFace = portfolio.reduce((s, h) => s + (Number(h.faceValueUsd) || 0), 0);
      const assetFace = portfolio
        .filter((h) => mapAssetClass(h.assetClass) === mapAssetClass(tapeAssetClass))
        .reduce((s, h) => s + (Number(h.faceValueUsd) || 0), 0);
      setCurrentAssetFace(assetFace);
      setTotalAssetFace(totalFace);
    } catch {
      setAvailable(null);
    }
  }, [tapeAssetClass]);

  // Not configured — render a quiet CTA
  if (available === null || available === 0) {
    return (
      <div className="mt-4 border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-4 rounded">
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Capital impact
          </span>
          <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-[200px]">
            Configure capital + portfolio at <a href="/app/capital" className="underline hover:text-[color:var(--color-accent)]">/app/capital</a> to see this bid's impact on your book.
          </span>
        </div>
      </div>
    );
  }

  const postBidAvailable = available - disciplinedBidDollars;
  const usagePct = available > 0 ? (disciplinedBidDollars / available) * 100 : 0;
  const postBidAssetFace = currentAssetFace + tapeFaceValue;
  const postBidTotalFace = totalAssetFace + tapeFaceValue;
  const postBidAssetPct =
    postBidTotalFace > 0 ? (postBidAssetFace / postBidTotalFace) * 100 : 0;
  const currentAssetPct =
    totalAssetFace > 0 ? (currentAssetFace / totalAssetFace) * 100 : 0;

  // Fit flags
  const capitalBlocked = postBidAvailable < 0;
  const capitalWarn = !capitalBlocked && usagePct > 40;
  const assetCap = concentrationPolicy?.maxPctPerAssetClass ?? null;
  const assetBlocked = assetCap !== null && postBidAssetPct > assetCap;
  const assetWarn = assetCap !== null && !assetBlocked && postBidAssetPct > assetCap * 0.85;

  const overallTone: "ok" | "warn" | "block" = capitalBlocked || assetBlocked
    ? "block"
    : capitalWarn || assetWarn
    ? "warn"
    : "ok";

  const toneColor =
    overallTone === "block"
      ? "var(--color-danger)"
      : overallTone === "warn"
      ? "var(--color-warn)"
      : "var(--color-success)";
  const toneLabel = overallTone === "block" ? "BLOCK" : overallTone === "warn" ? "WARN" : "OK";

  return (
    <div className="mt-4 border bg-[color:var(--color-bg-1)] p-4 rounded" style={{ borderColor: toneColor }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-[0.08em] font-semibold"
            style={{ background: toneColor, color: "var(--color-bg)" }}
          >
            {toneLabel}
          </span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Capital impact (at disciplined bid)
          </span>
        </div>
        <a
          href="/app/capital"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Full envelope at /app/capital →
        </a>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <ImpactStat
          label="Disciplined bid cost"
          value={formatUSD(disciplinedBidDollars)}
          sub={`${disciplinedBidCentsPerDollar.toFixed(2)}¢/$ of face`}
        />
        <ImpactStat
          label="Available before / after"
          value={`${formatUSD(available)} → ${formatUSD(postBidAvailable)}`}
          tone={capitalBlocked ? "danger" : capitalWarn ? "warn" : "ok"}
          sub={`${usagePct.toFixed(0)}% of available capital`}
        />
        <ImpactStat
          label={`${tapeAssetClass} concentration`}
          value={
            assetCap !== null
              ? `${currentAssetPct.toFixed(0)}% → ${postBidAssetPct.toFixed(0)}% (cap ${assetCap}%)`
              : `${currentAssetPct.toFixed(0)}% → ${postBidAssetPct.toFixed(0)}%`
          }
          tone={assetBlocked ? "danger" : assetWarn ? "warn" : "ok"}
          sub={assetCap === null ? "No cap configured" : ""}
        />
      </div>
      {capitalBlocked && (
        <p className="mt-3 text-[12.5px] text-[color:var(--color-danger)]">
          ✗ Bid exceeds available capital by {formatUSD(Math.abs(postBidAvailable))}. Raise capital, drop another live bid, or walk this deal.
        </p>
      )}
      {!capitalBlocked && assetBlocked && (
        <p className="mt-3 text-[12.5px] text-[color:var(--color-danger)]">
          ✗ Bidding this would push {tapeAssetClass} concentration past your {assetCap}% cap. Configure exception at /app/tools/tape (Concentration limits) or skip.
        </p>
      )}
      {overallTone === "ok" && (
        <p className="mt-3 text-[12.5px] text-[color:var(--color-success)]">
          ✓ Bid fits your capital and concentration limits. Safe to submit.
        </p>
      )}
    </div>
  );
}

// Map varied asset-class strings (from tape and from portfolio) into the
// same bucket so concentration math works across naming conventions.
function mapAssetClass(s: string | null | undefined): string {
  if (!s) return "Unspecified";
  const d = s.toLowerCase();
  if (d.includes("auto") || d.includes("vehicle")) return "Auto";
  if (d.includes("medic") || d.includes("hospital") || d.includes("health")) return "Medical";
  if (d.includes("mortgage") || d.includes("real") || d.includes("property") || d.includes("re "))
    return "Junior mortgage";
  if (d.includes("commercial") || d.includes("business")) return "Commercial";
  if (d.includes("specialty")) return "Specialty";
  if (d.includes("student")) return "Student";
  if (d.includes("tax")) return "Tax lien";
  return "Credit card";
}

function ImpactStat({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger" | "default";
  sub?: string;
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : "var(--color-fg)";
  return (
    <div className="rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-3 py-2.5">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px]" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[10px] text-[color:var(--color-fg-faint)]">{sub}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UNDERWRITING MEMO — AI-synthesized 1-page sign-off-ready memo. Compiles
// everything above (schema/SOL/license/concentration/bid) into a structured
// markdown memo via /api/tape-memo. NO row data, NO PII, NO raw header
// strings cross the wire — only aggregate summaries.
// ---------------------------------------------------------------------------

function buildMemoInput(
  aggregates: TapeAggregates,
  bid: { maxBid: number; maxBidCentsPerDollar: number; disciplinedBid: number; disciplinedBidCentsPerDollar: number },
  preset: AssetDefaults,
  effectiveLicense: EffectiveLicenseMap,
  concentrationPolicy: ConcentrationPolicy | null
): MemoInput {
  const totalFace = aggregates.totalFaceValue || 0;
  const license = computeLicenseImpact(effectiveLicense, aggregates.stateDistribution);
  const concentration = computeConcentrationReport(concentrationPolicy, aggregates);
  const sol = aggregates.solReport;

  // Sparse categories (<40% complete)
  const sparseCategories: string[] = [];
  for (const [cat, stat] of Object.entries(aggregates.completeness.byCategory)) {
    if (stat.total > 0 && stat.detected / stat.total < 0.4) {
      sparseCategories.push(cat.replace("_", " "));
    }
  }

  const topAsset = aggregates.assetClassDistribution[0]?.name ?? null;
  const pctOfFace = (v: number): number => (totalFace > 0 ? (v / totalFace) * 100 : 0);

  return {
    rowCount: aggregates.rowCount,
    totalFaceValue: totalFace,
    averageBalance: aggregates.averageBalance,
    topAssetClass: topAsset,

    schemaGrade: aggregates.completeness.grade,
    schemaWeightedPct: aggregates.completeness.weighted * 100,
    regFPass: aggregates.regF.pass,
    regFMissing: aggregates.regF.missing,
    detectedCanonicalFieldCount: aggregates.schema.byCanonical.size,
    totalCanonicalFieldCount: CANONICAL_FIELDS.length,
    sparseCategories,

    fingerprintLabel: aggregates.fingerprint.topMatch?.fingerprint.label ?? null,
    fingerprintConfidence: aggregates.fingerprint.topMatch?.confidence ?? 0,
    fingerprintWarnings: aggregates.fingerprint.topMatch?.fingerprint.warnings ?? [],
    balanceConventionLabel: shortConventionLabel(aggregates.balanceConvention.convention),
    balanceConventionWarning: aggregates.balanceConvention.warning,
    balanceConventionRowsCompared: aggregates.balanceConvention.rowsCompared,
    balanceConventionMeanDeltaPct: aggregates.balanceConvention.meanDelta * 100,

    solAccountsAnalyzed: sol?.totalAccountsAnalyzed ?? 0,
    solLapsedCount: sol?.byStatus.lapsed.count ?? 0,
    solLapsedFace: sol?.lapsedFaceValue ?? 0,
    solCliff90Count: (sol?.byStatus.cliff_30.count ?? 0) + (sol?.byStatus.cliff_90.count ?? 0),
    solCliff90Face: sol?.cliff90FaceValue ?? 0,
    solHealthyCount: sol?.byStatus.healthy.count ?? 0,
    solHealthyFace: sol?.byStatus.healthy.faceValue ?? 0,
    solAnchorMix: sol?.anchorMix ?? {
      last_payment_date: 0,
      charge_off_date: 0,
      open_date: 0,
      judgment_date: 0,
      none: 0,
    },

    topStates: aggregates.stateDistribution.slice(0, 5).map((s) => ({
      state: s.state,
      pct: pctOfFace(s.faceValue),
      faceValue: s.faceValue,
    })),
    topVintages: aggregates.vintageDistribution.slice(-5).map((v) => ({
      period: v.period,
      pct: pctOfFace(v.faceValue),
      faceValue: v.faceValue,
    })),
    assetClasses: aggregates.assetClassDistribution.slice(0, 5).map((a) => ({
      name: a.name,
      pct: pctOfFace(a.faceValue),
      faceValue: a.faceValue,
    })),

    licenseConfigured: license.policyConfigured,
    licenseCoveredFace: license.coveredFaceValue,
    licenseUncoveredFace: license.uncoveredFaceValue,
    licenseUncoveredPct: license.uncoveredPct,
    licenseTopUncoveredStates: license.uncoveredStates.slice(0, 5).map((s) => ({
      state: s.state,
      pct: s.facePct,
      faceValue: s.faceValue,
    })),

    concentrationConfigured: concentration.policyConfigured,
    concentrationPolicy: concentrationPolicy
      ? {
          state: concentrationPolicy.maxPctPerState,
          vintage: concentrationPolicy.maxPctPerVintage,
          assetClass: concentrationPolicy.maxPctPerAssetClass,
        }
      : null,
    concentrationBreaches: concentration.breaches.map((b) => ({
      dimension: b.dimension,
      key: b.key,
      pct: b.pct,
      limit: b.limit,
      severity: b.severity,
    })),

    bidPresetLabel: preset.label,
    bidRecoveryPct: preset.recoveryPct,
    bidWorkoutYears: preset.workoutYears,
    bidServicerFeePct: preset.servicerFeePct,
    bidIrrPct: preset.irrPct,
    bidMaxDollars: bid.maxBid,
    bidMaxCentsPerDollar: bid.maxBidCentsPerDollar,
    bidDisciplinedDollars: bid.disciplinedBid,
    bidDisciplinedCentsPerDollar: bid.disciplinedBidCentsPerDollar,
  };
}

function UnderwritingMemoSection({
  aggregates,
  bid,
  preset,
  licensePolicy,
  concentrationPolicy,
  markdown,
  loading,
  error,
  onGenerate,
  onClear,
}: {
  aggregates: TapeAggregates;
  bid: { maxBid: number; maxBidCentsPerDollar: number; disciplinedBid: number; disciplinedBidCentsPerDollar: number } | null;
  preset: AssetDefaults;
  licensePolicy: LicensePolicy | null;
  concentrationPolicy: ConcentrationPolicy | null;
  markdown: string | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: noop; user can select text manually
    }
  }

  if (!bid) return null;

  return (
    <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Step 3 · Underwriting memo (AI)
        </div>
        {markdown && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              {copied ? "✓ Copied" : "Copy markdown"}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {!markdown && !loading && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <p className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed flex-1 min-w-[240px]">
            Generate a 1-page sign-off-ready memo from everything above — schema fitness,
            originator fingerprint, SOL exposure, license coverage, concentration breaches,
            and the bid recommendation. Sent server-side as aggregates only; no PII or row
            data leaves your browser.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Generate memo →
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-3 text-[14px] text-[color:var(--color-fg-dim)]">
          Synthesizing memo…
        </div>
      )}

      {error && (
        <div className="mt-3 border border-[color:var(--color-danger)] bg-[color:var(--color-bg)] p-3 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </div>
      )}

      {markdown && (
        <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-5">
          <MarkdownMemo source={markdown} />
          <p className="mt-4 pt-4 border-t border-[color:var(--color-line)] text-[10px] font-mono text-[color:var(--color-fg-faint)] italic">
            AI-generated synthesis from in-browser tape analysis. Compliance signal, not legal
            advice. Verify state-specific SOL, license, and chain-of-custody requirements with
            counsel before bidding, filing suit, or sharing externally.
          </p>
        </div>
      )}
    </div>
  );
}

// Minimal markdown renderer — handles the strict format the memo prompt
// produces (h1, h2, paragraphs, bullet lists, **bold**). Keeps the bundle
// dependency-free; we control both sides of the contract.
function MarkdownMemo({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    // h1
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="text-xl font-medium tracking-tight text-[color:var(--color-fg)]">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    // h2
    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={key++}
          className="mt-4 font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    // Bullet list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="mt-2 space-y-1 list-disc pl-5 text-[13.5px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }
    // Blank line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Default: paragraph (collect until blank or next heading)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("# ") &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("- ")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="mt-2 text-[13.5px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }
  return <div>{blocks}</div>;
}

// ---------------------------------------------------------------------------
// CHAIN-OF-CUSTODY SECTION — drag the seller's media zip, get enforceable
// face value vs. quoted face value with per-account doc completeness.
// The killer differentiator: no incumbent product reconciles tape rows to
// media at parse time. Reference: Hartman $0-if-gap rule; CFPB Reg F
// itemization; state evidence rules.
// ---------------------------------------------------------------------------

function ChainOfCustodySection({
  tapeFaceValue,
  report,
  loading,
  error,
  mediaName,
  filename,
  onMediaSelected,
  onClear,
}: {
  tapeFaceValue: number;
  report: ChainOfCustodyReport | null;
  loading: boolean;
  error: string | null;
  mediaName: string | null;
  filename: string | null;
  onMediaSelected: (file: File) => void | Promise<void>;
  onClear: () => void;
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onMediaSelected(file);
    e.target.value = ""; // allow re-select of the same file
  }

  function downloadMissingDocs() {
    if (!report) return;
    const csv = missingDocsCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = (filename || "tape").replace(/\.[^.]+$/, "");
    a.download = `${baseName}__missing-docs.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>Step 2 · Chain-of-custody reconciliation</SectionLabel>
        {report && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadMissingDocs}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              ↓ Missing-docs CSV
            </button>
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-3xl">
        Drop the seller's media zip. We match each doc filename to a tape row by account
        number, classify it (bill of sale / assignment / application / statements / itemization
        / affidavit), and grade per-account chain-of-custody. Output:{" "}
        <strong className="text-[color:var(--color-fg)]">enforceable face value</strong> — the
        slice of the tape that survives a courtroom challenge. Almost always materially below
        the seller's quoted face. Zip is parsed in your browser; nothing uploaded.
      </p>

      {!report && !loading && (
        <div
          className="mt-4 rounded-lg p-6"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                Drop media zip
              </div>
              <p className="mt-2 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
                Seller delivered a media zip alongside the tape? Drop it here to reconcile.
                Filenames will be matched against the tape's account numbers; no PDF contents
                are extracted.
              </p>
            </div>
            <label className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition cursor-pointer shrink-0" style={{ background: "var(--gradient-primary)" }}>
              Choose media zip
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 text-[14px] text-[color:var(--color-fg-dim)]">
          Parsing {mediaName ? `"${mediaName}"` : "media zip"} and matching against tape…
        </div>
      )}

      {error && (
        <div className="mt-4 border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-4 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </div>
      )}

      {report && <ChainOfCustodyReportCard report={report} tapeFaceValue={tapeFaceValue} mediaName={mediaName} />}
    </section>
  );
}

function ChainOfCustodyReportCard({
  report,
  tapeFaceValue,
  mediaName,
}: {
  report: ChainOfCustodyReport;
  tapeFaceValue: number;
  mediaName: string | null;
}) {
  const enforceablePct = tapeFaceValue > 0 ? (report.enforceableFaceValue / tapeFaceValue) * 100 : 0;
  const partialPct = tapeFaceValue > 0 ? (report.partialFaceValue / tapeFaceValue) * 100 : 0;
  const uncollectablePct = tapeFaceValue > 0 ? (report.uncollectableFaceValue / tapeFaceValue) * 100 : 0;
  const deltaFromQuoted = tapeFaceValue - report.enforceableFaceValue;
  const matchRate = report.totalFilesInZip > 0
    ? (report.matchedFiles / report.totalFilesInZip) * 100
    : 0;

  return (
    <div className="mt-4 space-y-4">
      {/* HEADLINE — the killer line */}
      <div
        className="rounded-lg p-5"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
          Enforceable face value
        </div>
        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
          <span className="font-mono text-3xl tick text-[color:var(--color-fg)]">
            {formatUSD(report.enforceableFaceValue)}
          </span>
          <span className="font-mono text-[13px] text-[color:var(--color-fg-dim)]">
            of {formatUSD(tapeFaceValue)} quoted ({enforceablePct.toFixed(1)}%)
          </span>
        </div>
        {deltaFromQuoted > 0 && (
          <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            <strong className="text-[color:var(--color-danger)]">
              {formatUSD(deltaFromQuoted)} ({(100 - enforceablePct).toFixed(1)}%)
            </strong>{" "}
            of quoted face is not fully documented. That's the discount your bid should reflect — or
            the docs you should demand from the seller before closing.
          </p>
        )}
        {deltaFromQuoted <= 0 && (
          <p className="mt-3 text-[14px] text-[color:var(--color-success)]">
            ✓ Full chain present for every account. No documentation discount required.
          </p>
        )}
      </div>

      {/* Per-status face value breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
        <SolStat
          label="Enforceable (green)"
          count={
            report.perAccount.filter((a) => a.enforceabilityStatus === "green").length
          }
          faceValue={report.enforceableFaceValue}
          tone="ok"
          sub={`${enforceablePct.toFixed(1)}% of tape`}
        />
        <SolStat
          label="Partial (yellow)"
          count={
            report.perAccount.filter((a) => a.enforceabilityStatus === "yellow").length
          }
          faceValue={report.partialFaceValue}
          tone="warn"
          sub={`${partialPct.toFixed(1)}% of tape — collectable but evidentiary risk`}
        />
        <SolStat
          label="No docs (red)"
          count={
            report.perAccount.filter((a) => a.enforceabilityStatus === "red").length
          }
          faceValue={report.uncollectableFaceValue}
          tone="danger"
          sub={`${uncollectablePct.toFixed(1)}% of tape — legally indefensible`}
        />
      </div>

      {/* Per-doc-type completeness */}
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
          Per-account doc presence ({report.totalAccountsOnTape.toLocaleString()} accounts on tape)
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          <DocPresenceBar
            label="Bill of sale"
            count={report.accountsWithBillOfSale}
            total={report.totalAccountsOnTape}
            criticality="critical"
          />
          <DocPresenceBar
            label="Origination docs"
            count={report.accountsWithOriginationDocs}
            total={report.totalAccountsOnTape}
            criticality="critical"
          />
          <DocPresenceBar
            label="Itemization"
            count={report.accountsWithItemization}
            total={report.totalAccountsOnTape}
            criticality="critical"
          />
          <DocPresenceBar
            label="Assignment / allonge"
            count={report.accountsWithAssignment}
            total={report.totalAccountsOnTape}
            criticality="optional"
          />
        </div>
      </div>

      {/* Doc category inventory from the zip */}
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Media zip inventory
            {mediaName && (
              <span className="ml-2 text-[10px] tracking-[0.05em] text-[color:var(--color-fg-dim)] normal-case">
                ({mediaName})
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
            {report.totalFilesInZip.toLocaleString()} files · {formatBytes(report.totalBytesInZip)} ·{" "}
            {matchRate.toFixed(0)}% matched
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {(Object.entries(report.byDocCategory) as [DocCategory, { count: number; bytes: number }][])
            .filter(([, stat]) => stat.count > 0)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([cat, stat]) => (
              <div key={cat} className="flex items-baseline gap-2 font-mono text-[11px]">
                <span className="text-[color:var(--color-accent)] flex-1 truncate">
                  {DOC_CATEGORY_LABELS[cat]}
                </span>
                <span className="text-[color:var(--color-fg-dim)] tabular-nums">
                  {stat.count.toLocaleString()}
                </span>
                <span className="text-[color:var(--color-fg-faint)] tabular-nums w-16 text-right">
                  {formatBytes(stat.bytes)}
                </span>
              </div>
            ))}
        </div>
        {report.unmatchedFiles > 0 && (
          <div className="mt-3 pt-3 border-t border-[color:var(--color-line)]">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
              {report.unmatchedFiles.toLocaleString()} files could not be matched to accounts
            </div>
            <p className="mt-1 text-[11px] text-[color:var(--color-fg-faint)] italic">
              Common reasons: media named by seller's internal ID (not account #), media in a
              naming convention the matcher doesn't recognize, files at the zip root that apply
              to the whole tape (BoS, assignment, etc.). Examples:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {report.unmatchedExamples.slice(0, 12).map((fn) => (
                <span
                  key={fn}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-[color:var(--color-bg-2)] text-[color:var(--color-fg-dim)] border border-[color:var(--color-line)] truncate max-w-[28ch]"
                  title={fn}
                >
                  {fn.split("/").pop() ?? fn}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] font-mono text-[color:var(--color-fg-faint)] italic">
        V1 classifies docs by filename heuristics only. V2 will OCR PDFs to confirm doc type and
        extract bill-of-sale chain details for true graph reconciliation.
      </p>
    </div>
  );
}

function DocPresenceBar({
  label,
  count,
  total,
  criticality,
}: {
  label: string;
  count: number;
  total: number;
  criticality: "critical" | "optional";
}) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  const color =
    pct >= 90
      ? "var(--color-success)"
      : pct >= 70
      ? "var(--color-accent)"
      : pct >= 40
      ? "var(--color-warn)"
      : criticality === "critical"
      ? "var(--color-danger)"
      : "var(--color-fg-dim)";
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-[color:var(--color-fg-dim)] w-36 shrink-0">
        {label}
        {criticality === "critical" && (
          <span className="ml-1 text-[9px] text-[color:var(--color-fg-faint)]">REQ</span>
        )}
      </span>
      <div className="flex-1 h-1.5 bg-[color:var(--color-bg-2)] overflow-hidden rounded-sm">
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)] tabular-nums w-24 text-right">
        {count.toLocaleString()}/{total.toLocaleString()} · {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 B";
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** markers. Robust enough for the strict memo format.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="text-[color:var(--color-fg)] font-medium">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function describeAnchorMix(report: SolReport): string | null {
  const total = report.totalAccountsAnalyzed;
  if (total === 0) return null;
  const pct = (n: number) => ((n / total) * 100).toFixed(0);
  const parts: string[] = [];
  if (report.anchorMix.last_payment_date > 0)
    parts.push(`${pct(report.anchorMix.last_payment_date)}% by last-payment date`);
  if (report.anchorMix.charge_off_date > 0)
    parts.push(`${pct(report.anchorMix.charge_off_date)}% by charge-off date`);
  if (report.anchorMix.open_date > 0)
    parts.push(`${pct(report.anchorMix.open_date)}% by open date`);
  if (report.anchorMix.judgment_date > 0)
    parts.push(`${pct(report.anchorMix.judgment_date)}% by judgment date`);
  if (report.anchorMix.none > 0)
    parts.push(`${pct(report.anchorMix.none)}% with no anchor`);
  if (parts.length === 0) return null;
  return `SOL anchored as: ${parts.join(", ")}.`;
}
