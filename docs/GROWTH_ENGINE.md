# Growth Engine — the sales nervous system

**What it is:** an autonomous loop that *sells Tradeline itself*. It searches the
live web for businesses that would pay for Tradeline, drafts a tailored email
for each (with a link to a visual product tour), and queues them so you approve
with one tap. Flip one switch and it also sends automatically.

This is **not** the same thing as `lib/autopilot/*`. Autopilot automates the
outreach a debt buyer sends *to banks* to source deals — a product feature.
The Growth Engine automates the outreach that *acquires Tradeline customers*.
Two different jobs; they only share the Resend send path.

```
GitHub Actions (weekday) ─▶ /api/cron/growth-discover
        │
        ▼
  discover-llm.ts  ── Claude + web_search ──▶ real firms + PUBLIC business emails
        │
        ▼
  compose-llm.ts   ── one batched draft per firm + CAN-SPAM footer
        │
        ▼
  growth-queue.json (data branch)  ──▶  /app/growth  (approve / edit / skip)
        │                                     │
        │  auto-send ON                       │  you tap "Approve & send"
        ▼                                     ▼
            Resend ──▶ prospect inbox (Reply-To = your inbox)
                          │
                          ▼
              prospect opens /tour ──▶ /#pricing ──▶ Stripe checkout
```

## The pieces

| File | Role |
|------|------|
| `apps/web/lib/growth/store.ts` | Types + `growth-queue.json` read/write on the `data` branch (same pattern as autopilot state). |
| `apps/web/lib/growth/discover-llm.ts` | Claude Sonnet + `web_search` finds prospects and their **public business** emails. Drops any firm it can't find a real public email for. |
| `apps/web/lib/growth/compose-llm.ts` | Batched, segment-aware sales drafts. `withFooter()` appends the CAN-SPAM block (address + signed unsubscribe). |
| `apps/web/lib/growth/runner.ts` | Orchestrates discover → compose → queue → optional auto-send; emails you a summary. Also `sendApprovedLead()` used by the approve route. |
| `apps/web/app/api/growth/queue` | `GET` queue+config for the UI; `POST` config (CRON_SECRET). |
| `apps/web/app/api/growth/discover` | Run one discovery cycle on demand (CRON_SECRET). |
| `apps/web/app/api/growth/approve` | `POST {id, action:"send"|"skip", subject?, body?}` (CRON_SECRET). |
| `apps/web/app/api/cron/growth-discover` | Cron wrapper. |
| `apps/web/app/app/growth` | The approval desk — config dials + one-tap approve/edit/skip. |
| `apps/web/app/tour` | Public "how it works" visual walkthrough that the emails link to. |
| `.github/workflows/growth-discover.yml` | Weekday schedule that fires the cron endpoint. |

## Setup (env)

Most of these you already have from autopilot. The growth-only additions are
marked **NEW**.

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Web-search discovery + drafting. Web search is a billed server tool. |
| `RESEND_API_KEY`, `RESEND_FROM` | Sending. `RESEND_FROM` must be a domain you verified in Resend. |
| `GITHUB_PAT` | Read/write `growth-queue.json` on the `data` branch (`contents:write`). |
| `CRON_SECRET` | Gates discovery, config, and approve. Same token the Autopilot UI stores. |
| `PROFILE_YOUR_NAME`, `PROFILE_FIRM_NAME` | Sender identity used to tailor tone. |
| `PROFILE_EMAIL` / `REPORT_LEADS_NOTIFY_TO` | Where replies and run summaries land. |
| `GROWTH_POSTAL_ADDRESS` | **NEW** — physical mailing address for the CAN-SPAM footer. Required by law on commercial email. |
| `NEXT_PUBLIC_SITE_URL` | Used to build the `/tour` link and the unsubscribe URL. |

For the GitHub Action, also set repo secrets `CRON_SECRET` and `SITE_URL`.

## How to run it

1. Open **/app/growth**, paste your `CRON_SECRET` once (stored locally).
2. Pick segments + geography, set how many to find per run and the daily send cap.
3. Toggle **Enabled**. Leave **Auto-send OFF** to approve each email yourself.
4. Hit **Run discovery** (or wait for the 10:00 ET weekday cron). Drafts appear below.
5. Read each, edit if you like, tap **Approve & send**. Replies hit your inbox.
6. When you trust the drafts, flip **Auto-send ON** for fully hands-off operation.

## Guardrails (read before going live)

- **Business email only.** The discoverer is instructed to return only public
  business mailboxes (info@/sales@/named roles published on a company site or a
  legit directory) and to drop any firm it can't find one for — no guessed or
  pattern-built addresses, no consumer data, no list buying.
- **CAN-SPAM.** Every email carries a physical address (`GROWTH_POSTAL_ADDRESS`)
  and a one-click unsubscribe (reuses the existing signed `/api/unsubscribe`).
  Unsubscribed addresses are suppressed at *both* discovery and send.
- **This is B2B sales outreach**, separate from FCRA/Reg F (which governs
  consumer-debt contact — see `01_LEGAL_COMPLIANCE.md`). Keep it that way:
  you're emailing businesses about software, never consumers about debts.
- **Warm up your domain.** Start with a low daily cap and auto-send off.
