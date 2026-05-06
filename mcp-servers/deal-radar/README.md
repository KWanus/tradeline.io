# mcp-servers/deal-radar

MCP server exposing Tradeline's deal-sourcing radar to AI agents (Claude Desktop, Cursor, internal agents).

## Why

Your competitors will sell a dashboard. You'll sell a dashboard *and* an MCP. A licensed buyer who plugs Tradeline into Claude Desktop can ask:

> "What regional banks have charge-offs accelerating more than 100% YoY and recent matched news? Pull the latest filings."

…and get a real answer in one shot. That's a different posture from "log into another portal."

## Tools

| Tool | Purpose |
|---|---|
| `summary` | Snapshot timestamp, totals, top-five originators by confidence |
| `list_originators` | Ranked bank list, filterable by tier and min_confidence |
| `get_originator` | Drill into one bank: signals + filings + matched news |
| `list_signals` | Recent SEC signals (EDGAR + XBRL), filterable by type, source, confidence |
| `list_news` | News from RSS, defaults to matched-only; filter by ticker |

## Build & install

```bash
cd mcp-servers/deal-radar
npm install
npm run build
```

## Run from Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tradeline-deal-radar": {
      "command": "node",
      "args": ["/Users/kwanus/Desktop/tradeline.io/mcp-servers/deal-radar/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop and look for the connector in the Tools menu.

## Snapshot source

Reads `data/output/radar_snapshot.json` relative to the repo root by default. Override:

| Env var | Effect |
|---|---|
| `TRADELINE_SNAPSHOT_PATH` | Absolute or relative path to a snapshot JSON file |
| `TRADELINE_SNAPSHOT_URL` | HTTP(S) URL — fetched on every tool call. Use the deployed `/api/radar` once Vercel is live. |

## Try it from the CLI

`npx @modelcontextprotocol/inspector node dist/index.js` opens a UI for poking the tools.
