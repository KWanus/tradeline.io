#!/usr/bin/env node
/**
 * Tradeline Deal Radar — MCP server.
 *
 * Exposes the same data the /radar dashboard renders to AI agents over MCP.
 * Reads data/output/radar_snapshot.json from the repo root by default.
 * Override with TRADELINE_SNAPSHOT_PATH or TRADELINE_SNAPSHOT_URL.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---- types -----------------------------------------------------------------

type Originator = {
  ticker: string;
  name: string | null;
  tier: string | null;
  filings: number;
  signals: number;
  news_mentions: number;
  max_confidence: number;
  last_filed_at: string;
};

type SecSignal = {
  source: string;
  source_id: string;
  ticker: string;
  originator_name?: string;
  tier?: string;
  signal_type: string;
  confidence: number;
  filed_at: string;
  form_type: string;
  url: string;
  excerpt?: string;
  rationale?: string;
  // XBRL fields
  concept?: string;
  period_label?: string;
  yoy_pct?: number | null;
};

type NewsSignal = {
  source: string;
  source_id: string;
  query_label: string;
  title: string;
  link: string;
  published_at: string;
  publisher: string;
  matched_tickers?: string[];
};

type Filing = {
  source_id: string;
  ticker: string;
  originator_name?: string;
  form_type: string;
  filed_at: string;
  url: string;
  description?: string;
  items?: string[];
};

type Snapshot = {
  generated_at: string;
  summary: {
    filings_total: number;
    sec_signals_total: number;
    news_signals_total: number;
    news_signals_matched: number;
    originators_with_filings: number;
  };
  originators: Originator[];
  top_signals: SecSignal[];
  top_news: NewsSignal[];
  matched_news: NewsSignal[];
  recent_filings: Filing[];
};

// ---- snapshot loading ------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../../..",
  "data",
  "output",
  "radar_snapshot.json"
);

async function loadSnapshot(): Promise<Snapshot> {
  const url = process.env.TRADELINE_SNAPSHOT_URL;
  if (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
    return (await r.json()) as Snapshot;
  }
  const filePath = process.env.TRADELINE_SNAPSHOT_PATH || DEFAULT_SNAPSHOT_PATH;
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as Snapshot;
}

// ---- helpers ---------------------------------------------------------------

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

// ---- tool implementations --------------------------------------------------

async function summary() {
  const snap = await loadSnapshot();
  return jsonResult({
    generated_at: snap.generated_at,
    ...snap.summary,
    top_originators: snap.originators.slice(0, 5).map((o) => ({
      ticker: o.ticker,
      name: o.name,
      max_confidence: o.max_confidence,
      signals: o.signals,
      news_mentions: o.news_mentions,
    })),
  });
}

async function listOriginators(args: {
  tier?: string;
  min_confidence?: number;
  limit?: number;
}) {
  const snap = await loadSnapshot();
  let rows = snap.originators;
  if (args.tier) rows = rows.filter((o) => o.tier === args.tier);
  if (typeof args.min_confidence === "number") {
    rows = rows.filter((o) => o.max_confidence >= args.min_confidence!);
  }
  return jsonResult(rows.slice(0, args.limit ?? 20));
}

async function getOriginator(args: { ticker: string }) {
  const snap = await loadSnapshot();
  const t = args.ticker.toUpperCase();
  const originator = snap.originators.find((o) => o.ticker === t);
  if (!originator) {
    return errorResult(`originator not found: ${args.ticker}`);
  }
  const signals = snap.top_signals.filter((s) => s.ticker === t);
  const filings = snap.recent_filings.filter((f) => f.ticker === t).slice(0, 25);
  const news = snap.matched_news.filter((n) => n.matched_tickers?.includes(t)).slice(0, 25);
  return jsonResult({ originator, signals, filings, news });
}

async function listSignals(args: {
  signal_type?: string;
  min_confidence?: number;
  source?: "sec_edgar" | "sec_xbrl";
  limit?: number;
}) {
  const snap = await loadSnapshot();
  let rows = snap.top_signals;
  if (args.signal_type) rows = rows.filter((s) => s.signal_type === args.signal_type);
  if (args.source) rows = rows.filter((s) => s.source === args.source);
  if (typeof args.min_confidence === "number") {
    rows = rows.filter((s) => s.confidence >= args.min_confidence!);
  }
  rows = [...rows].sort((a, b) => b.confidence - a.confidence);
  return jsonResult(rows.slice(0, args.limit ?? 20));
}

async function listNews(args: { ticker?: string; matched_only?: boolean; limit?: number }) {
  const snap = await loadSnapshot();
  let rows = args.matched_only === false ? snap.top_news : snap.matched_news;
  if (args.ticker) {
    const t = args.ticker.toUpperCase();
    rows = rows.filter((n) => n.matched_tickers?.includes(t));
  }
  return jsonResult(rows.slice(0, args.limit ?? 20));
}

// ---- server wiring ---------------------------------------------------------

const server = new Server(
  { name: "tradeline-deal-radar", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "summary",
      description:
        "High-level radar summary: snapshot timestamp, totals, and the five highest-confidence originators.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_originators",
      description:
        "Return ranked originators (banks). Sorted by max signal confidence, then signal count, then news mentions.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          tier: {
            type: "string",
            enum: ["GSIB", "super-regional", "regional", "community", "specialty"],
            description: "Filter by tier.",
          },
          min_confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Filter by max signal confidence (0–1).",
          },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
        },
      },
    },
    {
      name: "get_originator",
      description:
        "Drill into a single originator: aggregate row plus its signals, filings, and matched news.",
      inputSchema: {
        type: "object",
        required: ["ticker"],
        additionalProperties: false,
        properties: {
          ticker: { type: "string", description: "Stock ticker, case-insensitive." },
        },
      },
    },
    {
      name: "list_signals",
      description:
        "Return scored signals from SEC EDGAR + XBRL. Filter by signal_type, source, confidence floor.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          signal_type: {
            type: "string",
            enum: [
              "portfolio_sale_announced",
              "divestiture_announced",
              "reserve_build",
              "charge_off_increase",
              "npl_ratio_increase",
              "guidance_change",
              "unspecified",
            ],
          },
          source: { type: "string", enum: ["sec_edgar", "sec_xbrl"] },
          min_confidence: { type: "number", minimum: 0, maximum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
        },
      },
    },
    {
      name: "list_news",
      description:
        "Return news headlines from public RSS, optionally filtered by ticker (matched_tickers). Defaults to matched-only.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string", description: "Filter by matched ticker, case-insensitive." },
          matched_only: { type: "boolean", default: true },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  try {
    switch (request.params.name) {
      case "summary":
        return await summary();
      case "list_originators":
        return await listOriginators(args as Parameters<typeof listOriginators>[0]);
      case "get_originator":
        return await getOriginator(args as Parameters<typeof getOriginator>[0]);
      case "list_signals":
        return await listSignals(args as Parameters<typeof listSignals>[0]);
      case "list_news":
        return await listNews(args as Parameters<typeof listNews>[0]);
      default:
        return errorResult(`unknown tool: ${request.params.name}`);
    }
  } catch (err) {
    return errorResult(`${request.params.name} failed: ${(err as Error).message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
