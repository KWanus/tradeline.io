.PHONY: help setup workers radar snapshot dev build mcp-build mcp-test clean

help:
	@echo "Tradeline make targets:"
	@echo "  make setup      Bootstrap Python venv + workspace install"
	@echo "  make workers    Run full ingest (SEC + XBRL + news + court)"
	@echo "  make radar      Run workers and start the dev server"
	@echo "  make snapshot   Refresh the radar snapshot only (no ingest)"
	@echo "  make dev        Start Next.js dev server"
	@echo "  make build      Production build of apps/web"
	@echo "  make mcp-build  Compile the deal-radar MCP server"
	@echo "  make mcp-test   Smoke-test MCP server with raw JSON-RPC"
	@echo "  make clean      Remove venvs, node_modules, build outputs (keep data)"

setup:
	@command -v python3 >/dev/null || (echo "python3 not found"; exit 1)
	cd workers && python3 -m venv .venv && . .venv/bin/activate && \
	  pip install --upgrade pip --quiet && pip install requests feedparser python-dateutil --quiet
	npm install
	cd mcp-servers/deal-radar && npm install --silent

workers:
	. workers/.venv/bin/activate && python -m workers.run

snapshot:
	. workers/.venv/bin/activate && python -c \
	  "from workers.run import _build_radar_snapshot as b; from workers import storage; storage.write_snapshot('radar_snapshot', b()); print('snapshot updated')"

radar: snapshot
	npm run dev --workspace=apps/web

dev:
	npm run dev --workspace=apps/web

build:
	npm run build --workspace=apps/web

mcp-build:
	cd mcp-servers/deal-radar && npm run build

mcp-test: mcp-build
	@printf '%s\n' \
	  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoketest","version":"0"}}}' \
	  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
	  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"summary","arguments":{}}}' \
	  | node mcp-servers/deal-radar/dist/index.js | sed -n 's/.*"text":"\(.\{0,160\}\).*/\1/p'

clean:
	rm -rf workers/.venv node_modules apps/web/node_modules apps/web/.next \
	       mcp-servers/*/node_modules mcp-servers/*/dist
	@echo "(data/output preserved — delete manually if you want a fresh ingest)"
