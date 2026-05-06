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

export type RadarSnapshot = {
  generated_at: string;
  summary: {
    filings_total: number;
    sec_signals_total: number;
    news_signals_total: number;
    news_signals_matched: number;
    court_signals_total: number;
    originators_with_filings: number;
  };
  originators: Originator[];
  top_signals: SecSignal[];
  top_news: NewsSignal[];
  matched_news: NewsSignal[];
  court_signals: CourtSignal[];
  recent_filings: Filing[];
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
  },
  originators: [],
  top_signals: [],
  matched_news: [],
  court_signals: [],
  top_news: [],
  recent_filings: [],
};

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "radar_snapshot.json"
);

export async function readSnapshot(): Promise<RadarSnapshot> {
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
