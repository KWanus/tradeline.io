# Deploy

Two pieces:
1. **`apps/web`** → Vercel (free tier)
2. **`workers/`** → GitHub Actions cron (free) writing snapshots to an orphan `data` branch
3. **`mcp-servers/deal-radar`** → published to npm or run locally; reads the same snapshot URL

Total infra cost at Phase 1: **$0**.

---

## 1. Push to GitHub

```bash
gh repo create tradeline-io --private --source=. --remote=origin
git push -u origin main
```

(Or create the repo in the UI and `git remote add origin …`.)

## 2. Set repo secrets

```bash
gh secret set TRADELINE_SEC_UA --body "Tradeline workers your-email@example.com"
```

The SEC asks for a contact email in the worker User-Agent. Use one you actually read — they email you if a worker misbehaves.

## 3. Enable Actions

Repo → Settings → Actions → "Allow all actions". The first scheduled run kicks off within 6 hours; trigger one immediately:

```bash
gh workflow run workers.yml
gh run list --workflow workers.yml --limit 5
```

After the first successful run, a new branch `data` exists with `radar_snapshot.json` at its root. The raw URL is:

```
https://raw.githubusercontent.com/<owner>/<repo>/data/radar_snapshot.json
```

## 4. Deploy apps/web on Vercel

```bash
npx vercel link        # one-time, attach the project
npx vercel env add TRADELINE_SNAPSHOT_URL production
# paste: https://raw.githubusercontent.com/<owner>/tradeline-io/data/radar_snapshot.json
npx vercel --prod
```

`vercel.json` is configured so the `data` branch never triggers a Vercel redeploy — only `main` does. Cron runs are silent.

## 5. Wire MCP into Claude Desktop

For local use, point at the on-disk snapshot:

```json
{
  "mcpServers": {
    "tradeline-deal-radar": {
      "command": "node",
      "args": ["/Users/you/Desktop/tradeline.io/mcp-servers/deal-radar/dist/index.js"]
    }
  }
}
```

For *anywhere*-use against the deployed snapshot:

```json
{
  "mcpServers": {
    "tradeline-deal-radar": {
      "command": "node",
      "args": ["/Users/you/Desktop/tradeline.io/mcp-servers/deal-radar/dist/index.js"],
      "env": {
        "TRADELINE_SNAPSHOT_URL": "https://raw.githubusercontent.com/<owner>/tradeline-io/data/radar_snapshot.json"
      }
    }
  }
}
```

---

## Operational notes

- **First Vercel deploy with no snapshot URL set** renders the radar page with the empty state and instructions. Fine.
- **GitHub Actions runtime** ≈ 5–8 minutes for a full SEC + XBRL + news + court pass. Well under the 2,000 free monthly minutes the cron uses (~96 runs/month × 6 min ≈ 576 min). You'll never hit the cap.
- **CourtListener** is a non-profit; if you scale this to a paying-customer count where the cron load matters, get an API key from them and stash it as `TRADELINE_COURTLISTENER_TOKEN`.
- **Vercel free tier** caps at 100 GB-hours/month of Serverless Function execution. The `/api/radar` route is dynamic but lightweight; you'd need ~10k page views/day to dent the cap.

## When to upgrade

| Trigger | Move to |
|---|---|
| Snapshot exceeds ~25 MB | Store it on Supabase Storage or S3 instead of a git branch |
| Customers want sub-15-min freshness | Cloudflare Workers cron + Cloudflare KV |
| Customer-tape uploads enter | Supabase Postgres + RLS (schema in `docs/schema.sql`) |
| MCP usage hits 1k+ tool calls/day | Publish to npm and run as a hosted MCP via `mcp-server-host` |
