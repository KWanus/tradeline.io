# mcp-servers

Three MCP (Model Context Protocol) servers that expose Tradeline data to AI agents (Claude Desktop, Cursor, internal agents).

| Server | Purpose | Build phase |
|---|---|---|
| `deal-radar` | search deals, get detail, subscribe to criteria | Week 7 (Phase 1) |
| `portfolio-pulse` | score uploaded tapes, compare to market | Week 9–10 (Phase 2) |
| `compliance-tracker` | state license / bond / Reg F lookups | Week 13–14 (Phase 2) |

Each server is a thin adapter over the REST API in `apps/web/app/api/*` (or `services/scoring`). TypeScript SDK preferred for the radar/compliance servers; Python for `portfolio-pulse` since it sits next to the scoring service.

## Status

Stubs. See `02_ARCHITECTURE.md` § "MCP Server Layer".
