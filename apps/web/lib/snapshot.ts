import { promises as fs } from "node:fs";
import path from "node:path";

export type Originator = {
  ticker: string;
  name: string | null;
  tier: string | null;
  filings: number;
  signals: number;
  news_mentions: number;
  max_confidence: number;
  last_filed_at: string;
  auto_discovered?: boolean;
  /** From seed/banks.csv. Values: "multi", "consumer", "credit-card",
   * "auto", "mortgage", "student", etc. Lets the SEC enrichment helper
   * pick a sharper broker for SEC bank outreach. */
  asset_class_focus?: string;
};

export type Candidate = {
  ticker: string | null;
  cik: string;
  name: string;
  sic: string;
  accession: string;
  form_type: string;
  items: string[];
  filed_at: string;
  description: string;
  url: string;
  confidence: number;
  discovered_at: string;
  auto_promoted: boolean;
  promoted_at: string | null;
};

export type SecSignal = {
  source: string;
  source_id: string;
  ticker: string;
  cik?: string;
  originator_name?: string;
  tier?: string;
  signal_type: string;
  confidence: number;
  filed_at: string;
  form_type: string;
  items?: string[];
  url: string;
  excerpt?: string;
  rationale?: string;
  // XBRL-only fields
  concept?: string;
  period_label?: string;
  period_end?: string;
  yoy_pct?: number | null;
};

export type NewsSignal = {
  source: string;
  source_id: string;
  query_label: string;
  title: string;
  link: string;
  published_at: string;
  summary: string;
  publisher: string;
  matched_tickers?: string[];
};

export type Filing = {
  source: string;
  source_id: string;
  ticker: string;
  originator_name?: string;
  tier?: string;
  form_type: string;
  filed_at: string;
  period_of_report?: string;
  url: string;
  description?: string;
  items?: string[];
};

export type CourtSignal = {
  source: string;
  source_id: string;
  query_label: string;
  case_name: string;
  court: string;
  court_short: string;
  date_filed: string;
  snippet: string;
  absolute_url: string;
  cite_count: number;
};

/**
 * Community-bank signal from the FDIC Call Report worker. FDIC institutions
 * have no stock ticker, so `ticker` is a synthetic "FDIC-{cert}" key.
 */
export type FdicSignal = {
  source: string;
  source_id: string;
  cert: string;
  ticker: string;
  originator_name: string;
  state: string;
  /** Institution city — FDIC institutions endpoint / NCUA FOICU master.
   * Lets the radar show "Roanoke, VA" so buyers can find *local* sellers
   * to call directly, not just a state. May be "" on older snapshots. */
  city?: string;
  /** County name (FDIC only; NCUA reports county as a numeric code). */
  county?: string;
  tier: string;
  signal_type: string;
  confidence: number;
  filed_at: string;
  form_type: string;
  concept: string;
  period_end: string;
  period_label: string;
  value: number;
  prior_year_value: number;
  yoy_pct: number;
  asset_total: number;
  url: string;
  rationale: string;
  /** Per-asset-class net charge-off breakdown (FDIC only, charge-off signals
   * only). Keys: credit_card, auto, real_estate, commercial. Values in $.
   * Lets the UI say "mostly auto (62%)" instead of generic "charge-offs up". */
  breakdown?: Record<string, number>;
  /** Number of distinct quarter-ends this institution has appeared in the
   * signal history. 1 = first-time spike, ≥2 = persistent. Computed by
   * the snapshot builder from the full JSONL history. */
  appearances?: number;
};

/**
 * Credit-union signal from the NCUA Call Report worker. Structurally identical
 * to an FdicSignal — `cert` holds the NCUA charter number, `tier` is
 * "credit-union" — so the same UI renders both community-institution streams.
 */
export type NcuaSignal = FdicSignal;

/** One disposition event in the backtest: a disclosed portfolio sale and
 * whether a leading radar signal preceded it. */
export type BacktestEvent = {
  originator_name: string;
  ticker: string | null;
  event_type: string;
  /** True when the disposition is a keyword-confirmed debt-portfolio sale
   * (vs. a generic item-2.01 disposition that may be M&A / branch / RE). */
  confirmed: boolean;
  event_date: string;
  event_url: string | null;
  predicted: boolean;
  lead_days: number | null;
  leading_type: string | null;
  leading_date: string | null;
  leading_url: string | null;
  leading_yoy_pct: number | null;
};

/** Automated backtest of the radar: of the disclosed dispositions we observed,
 * how many did a leading signal flag in advance, and how early. */
export type TrackRecord = {
  generated_at: string;
  window_days: number;
  /** Headline metrics — CONFIRMED debt-portfolio sales only. */
  confirmed_total: number;
  confirmed_predicted: number;
  hit_rate: number | null;
  /** Generic item-2.01 dispositions (M&A / branch / RE) — context only. */
  candidate_total: number;
  candidate_predicted: number;
  candidate_hit_rate: number | null;
  /** Combined, for the "instrumentation is live" view. */
  events_total: number;
  events_predicted: number;
  median_lead_days: number | null;
  avg_lead_days: number | null;
  by_leading_type: Record<string, number>;
  events: BacktestEvent[];
  population: string;
};

/** A national consumer-credit stress series (FRED). */
export type MacroSeries = {
  key: string;
  label: string;
  value: number;
  as_of: string;
  yoy_change: number | null;
  trend: "rising" | "falling" | "flat";
};

/** Per-state economic context (FRED/BLS unemployment). */
export type MacroState = {
  unemployment: number;
  as_of: string;
  yoy_change: number | null;
  trend: "rising" | "falling" | "flat";
};

/** Macro backdrop: national consumer-credit stress + per-state unemployment.
 * Context for the per-originator radar — is supply building nationally, and
 * how stressed is each state's economy. */
export type Macro = {
  generated_at: string;
  national: MacroSeries[];
  states: Record<string, MacroState>;
  stress_direction: "rising" | "easing" | "mixed";
};

/** One institution whose distressed book left the balance sheet (public Call
 * Report proxy — sold or written off). */
export type ClearedBook = {
  cert: string;
  ticker: string;
  originator_name: string;
  state: string;
  noncurrent_prior: number;
  noncurrent_latest: number;
  drop_pct: number;
  /** Earliest quarter we flagged this cert ('YYYY-MM-DD'). */
  first_flagged: string;
  /** Days from that first flag to this clear. 0 = flagged the same quarter
   * (no lead yet); > 0 = the radar called it that many days early. */
  lead_days: number | null;
  filed_at: string;
  url: string;
};

/** Supply intelligence: flagged institutions that cleared their distressed
 * book this quarter — a permission-free public proxy for "the paper moved." */
export type ClearedBooks = {
  count: number;
  as_of: string;
  /** How many cleared books we had flagged in an EARLIER quarter (lead > 0). */
  flagged_early: number;
  /** Median lead time across those early-flagged clears. */
  median_lead_days: number | null;
  top: ClearedBook[];
};

export type RadarSnapshot = {
  generated_at: string;
  track_record?: TrackRecord;
  cleared_books?: ClearedBooks;
  macro?: Macro | null;
  summary: {
    filings_total: number;
    sec_signals_total: number;
    news_signals_total: number;
    news_signals_matched: number;
    court_signals_total: number;
    fdic_signals_total?: number;
    ncua_signals_total?: number;
    originators_with_filings: number;
    auto_discovered_count?: number;
    pending_candidates?: number;
  };
  originators: Originator[];
  top_signals: SecSignal[];
  top_news: NewsSignal[];
  matched_news: NewsSignal[];
  court_signals: CourtSignal[];
  recent_filings: Filing[];
  fdic_signals?: FdicSignal[];
  ncua_signals?: NcuaSignal[];
  candidates_pending?: Candidate[];
  candidates_promoted?: Candidate[];
};

export const EMPTY_SNAPSHOT: RadarSnapshot = {
  generated_at: "",
  summary: {
    filings_total: 0,
    sec_signals_total: 0,
    news_signals_total: 0,
    news_signals_matched: 0,
    court_signals_total: 0,
    originators_with_filings: 0,
    auto_discovered_count: 0,
    pending_candidates: 0,
  },
  originators: [],
  top_signals: [],
  matched_news: [],
  court_signals: [],
  top_news: [],
  recent_filings: [],
  fdic_signals: [],
  ncua_signals: [],
  candidates_pending: [],
  candidates_promoted: [],
};

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "radar_snapshot.json"
);

/**
 * Loading order:
 *   1. TRADELINE_SNAPSHOT_URL — production (Vercel) reads from a raw GitHub URL
 *      that the workers cron writes on the orphan `data` branch.
 *   2. Local file at ../../data/output/radar_snapshot.json — local dev.
 *   3. EMPTY_SNAPSHOT — first run, no data yet.
 */
export async function readSnapshot(): Promise<RadarSnapshot> {
  const url = process.env.TRADELINE_SNAPSHOT_URL;
  if (url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return (await r.json()) as RadarSnapshot;
      console.warn(`[snapshot] fetch ${url} failed: ${r.status}`);
    } catch (err) {
      console.warn(`[snapshot] fetch ${url} threw: ${(err as Error).message}`);
    }
  }
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw) as RadarSnapshot;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_SNAPSHOT;
    }
    throw err;
  }
}
