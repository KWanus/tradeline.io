import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400;

/**
 * OpenAPI 3.0 specification for the Tradeline public JSON APIs.
 *
 * Discoverable at /api/openapi.json. Any LangChain agent, MCP server,
 * or downstream consumer can pull this spec and call the endpoints
 * without reading docs.
 */
export function GET() {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
  ).replace(/\/$/, "");

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Tradeline API",
      version: "1.0.0",
      description:
        "Public read-only JSON for Tradeline radar state, changelog, and infrastructure health. Same data the HTML site renders; same data the RSS feeds publish.",
      contact: {
        name: "Tradeline",
        email: "hello@tradeline.io",
        url: `${siteUrl}/about`,
      },
      license: { name: "Proprietary", url: `${siteUrl}/terms` },
    },
    servers: [{ url: siteUrl, description: "Production" }],
    paths: {
      "/api/banks": {
        get: {
          operationId: "listBanks",
          summary: "List every tracked bank",
          description:
            "Returns every originator the radar tracks, sorted strong → watching → quiet → confidence desc. Optionally filter by status or tier.",
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["strong", "watching", "quiet"],
              },
              description: "Filter to a single status bucket.",
            },
            {
              name: "tier",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Exact-match tier filter (e.g. 'regional').",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 500 },
              description: "Cap result count. Default: no cap.",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BanksListResponse" },
                },
              },
            },
            "503": {
              description: "Snapshot unavailable",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/banks/{ticker}": {
        get: {
          operationId: "getBank",
          summary: "Per-bank radar state",
          description:
            "Returns one bank's status, confidence, top 12 signals, top 10 matched news, and links back to the HTML page + OG image.",
          parameters: [
            {
              name: "ticker",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Stock ticker (case-insensitive on input).",
              example: "COF",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BankResponse" },
                },
              },
            },
            "404": {
              description: "Ticker not tracked",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "503": {
              description: "Snapshot unavailable",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/news": {
        get: {
          operationId: "listNews",
          summary: "Recent matched news headlines",
          description:
            "Headlines from public news feeds matched to tracked banks, newest first. Same source as /news (HTML).",
          parameters: [
            {
              name: "ticker",
              in: "query",
              required: false,
              schema: { type: "string" },
              description:
                "Filter to headlines mentioning the given ticker (case-insensitive on input).",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 500 },
              description: "Cap result count. Default 50.",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/NewsListResponse" },
                },
              },
            },
            "503": {
              description: "Snapshot unavailable",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/changelog": {
        get: {
          operationId: "getChangelog",
          summary: "Public changelog as JSON",
          description:
            "Same entries as /changelog (HTML) and /changelog.xml (RSS), shaped for integrators. Stable per-entry anchors so consumers can deep-link.",
          parameters: [
            {
              name: "tag",
              in: "query",
              required: false,
              schema: { type: "string" },
              description:
                "Filter to entries that include the given tag (e.g. seo, email, public, api). Counts in the tags object stay relative to the full changelog.",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChangelogResponse" },
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          operationId: "getHealth",
          summary: "Site & infrastructure health",
          description:
            "Always 200. body.status (ok | degraded | stale) is the alert signal — designed for uptime monitors that can alert on body rather than HTTP code.",
          responses: {
            "200": {
              description: "Health payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", const: false },
            error: { type: "string" },
            detail: { type: "string" },
            ticker: { type: "string" },
          },
        },
        BankCounts: {
          type: "object",
          properties: {
            filings: { type: "integer" },
            signals: { type: "integer" },
            news: { type: "integer" },
          },
        },
        BankLinks: {
          type: "object",
          properties: {
            page: { type: "string", format: "uri" },
            api: { type: "string", format: "uri" },
            ogImage: { type: "string", format: "uri" },
          },
        },
        BankSummary: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            name: { type: ["string", "null"] },
            tier: { type: ["string", "null"] },
            status: { type: "string", enum: ["strong", "watching", "quiet"] },
            confidence: { type: "number" },
            counts: { $ref: "#/components/schemas/BankCounts" },
            lastFiledAt: { type: ["string", "null"], format: "date-time" },
            autoDiscovered: { type: "boolean" },
            links: { $ref: "#/components/schemas/BankLinks" },
          },
        },
        SignalItem: {
          type: "object",
          properties: {
            source: { type: "string" },
            sourceId: { type: "string" },
            signalType: { type: "string" },
            formType: { type: "string" },
            filedAt: { type: "string", format: "date-time" },
            confidence: { type: "number" },
            url: { type: "string", format: "uri" },
            excerpt: { type: ["string", "null"] },
            concept: { type: ["string", "null"] },
            periodLabel: { type: ["string", "null"] },
            yoyPct: { type: ["number", "null"] },
          },
        },
        NewsItem: {
          type: "object",
          properties: {
            sourceId: { type: "string" },
            title: { type: "string" },
            link: { type: "string", format: "uri" },
            publisher: { type: "string" },
            publishedAt: { type: "string", format: "date-time" },
          },
        },
        NewsListItem: {
          allOf: [
            { $ref: "#/components/schemas/NewsItem" },
            {
              type: "object",
              properties: {
                matchedTickers: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          ],
        },
        NewsListResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            count: { type: "integer" },
            total: { type: "integer" },
            filters: {
              type: "object",
              properties: {
                ticker: { type: ["string", "null"] },
                limit: { type: "integer" },
              },
            },
            tickers: {
              type: "object",
              additionalProperties: { type: "integer" },
              description: "Ticker → headline count over the full snapshot.",
            },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/NewsListItem" },
            },
            links: {
              type: "object",
              properties: { page: { type: "string", format: "uri" } },
            },
            snapshot: {
              type: "object",
              properties: {
                generatedAt: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
        },
        BanksListResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            count: { type: "integer" },
            totalTracked: { type: "integer" },
            filters: {
              type: "object",
              properties: {
                status: { type: ["string", "null"] },
                tier: { type: ["string", "null"] },
                limit: { type: ["integer", "null"] },
              },
            },
            banks: {
              type: "array",
              items: { $ref: "#/components/schemas/BankSummary" },
            },
            snapshot: {
              type: "object",
              properties: {
                generatedAt: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
        },
        BankResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            ticker: { type: "string" },
            name: { type: ["string", "null"] },
            tier: { type: ["string", "null"] },
            status: { type: "string", enum: ["strong", "watching", "quiet"] },
            confidence: { type: "number" },
            counts: { $ref: "#/components/schemas/BankCounts" },
            lastFiledAt: { type: ["string", "null"], format: "date-time" },
            autoDiscovered: { type: "boolean" },
            signals: {
              type: "array",
              items: { $ref: "#/components/schemas/SignalItem" },
            },
            news: {
              type: "array",
              items: { $ref: "#/components/schemas/NewsItem" },
            },
            links: {
              type: "object",
              properties: {
                page: { type: "string", format: "uri" },
                ogImage: { type: "string", format: "uri" },
              },
            },
            snapshot: {
              type: "object",
              properties: {
                generatedAt: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
        },
        ChangelogEntry: {
          type: "object",
          properties: {
            anchor: { type: "string" },
            date: { type: "string", format: "date" },
            title: { type: "string" },
            summary: { type: ["string", "null"] },
            bullets: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            links: {
              type: "object",
              properties: { page: { type: "string", format: "uri" } },
            },
          },
        },
        ChangelogResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            count: { type: "integer" },
            totalReleases: { type: "integer" },
            latest: { type: ["string", "null"], format: "date" },
            filters: {
              type: "object",
              properties: { tag: { type: ["string", "null"] } },
            },
            tags: {
              type: "object",
              additionalProperties: { type: "integer" },
              description: "Tag → release count over the full changelog.",
            },
            entries: {
              type: "array",
              items: { $ref: "#/components/schemas/ChangelogEntry" },
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "degraded", "stale"] },
            checks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  ok: { type: "boolean" },
                  detail: { type: "string" },
                },
              },
            },
            stats: {
              type: "object",
              properties: {
                banks: { type: "integer" },
                signals: { type: "integer" },
                snapshotAgeHours: { type: ["number", "null"] },
                snapshotGeneratedAt: { type: ["string", "null"] },
              },
            },
            build: {
              type: "object",
              properties: {
                sha: { type: ["string", "null"] },
                env: { type: "string" },
              },
            },
            latencyMs: { type: "integer" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
