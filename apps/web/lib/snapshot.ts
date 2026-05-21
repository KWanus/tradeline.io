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
};

export type RadarSnapshot = {
  generated_at: string;
  summary: {
    filings_total: number;
    sec_signals_total: number;
    news_signals_total: number;
    news_signals_matched: number;
    court_signals_total: number;
    fdic_signals_total?: number;
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
