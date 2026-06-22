# Tradeline — Next-Up Plan

**Generated:** 2026-05-24
**Source:** Post-session capability audit
**Stage:** Operator surface complete; production-hardening + capability gaps next

> **Status (2026-06-22 — "remaining phases" pass):** the build was committed
> mid-flight with 15 forward-referenced modules that were never written — the
> repo did not compile. Those are now implemented and the build is green
> (`tsc --noEmit` + `next build` pass, `npm test` = 29 passing).
>
> | Phase | State |
> |---|---|
> | **P0** Real backend | Scaffolding shipped — `lib/db.ts` + `supabase/migrations/0001_init.sql` (RLS). P0-5 export/import already live. P0-3/P0-4 async-store rewrite gated on a live DB. |
> | **P1** Reply loop | ✅ `lib/replies.ts`, reply-correlation, dnc-server, `/api/inbound-email`, Today reply cards. P1-1 NCUA verify still needs a live worker run. |
> | **P2** Bid write-back + Stripe | ✅ bid write-back (`setBidOnDeal`) + `/api/billing/payment-link` + renewal-card embed. |
> | **P3** RE / gov-contracting | Deferred per plan (gate: recurring debt-side revenue). |
> | **P4** Tests + typed routes | ✅ Vitest + 29 tests. Typed-route errors moot (typedRoutes off). Sentry optional. |
> | **P5** RAG tutor | Local form ✅ (tutor grounded in pipeline + closed-deal history). pgvector embeddings gated on P0. |

---

## Priority order

| # | Phase | Goal | Est. |
|---|---|---|---|
| **P0** | **Real backend** | Move 8 localStorage stores to Supabase + auth + backup so a browser wipe doesn't erase the business | ~3 days |
| **P1** | **NCUA verification + reply loop** | Confirm the NCUA worker actually returns data; wire `/api/classify-reply` into the inbox so broker replies surface as cards | ~1 day |
| **P2** | **Bid write-back + Stripe links** | Close the two existing-flow loops: calculator output writes to the deal, renewal cards include a real Stripe link | ~1 day |
| **P3** | **Real estate / gov-contracting modules** | Add `/app/properties` and `/app/contracts` as multi-vertical extensions of the operator OS | ~1–2 weeks each, deferred |
| **P4** | **Tests + typed-route cleanup + observability** | Vitest on the math libs, fix 158 pre-existing `<Link>` errors, wire Sentry | ~2 days |
| **P5** | **RAG tutor** | Tutor reads pipeline notes + closed-deal history + outreach log for context-aware answers | ~2–3 days |

**Today's two derisking moves (do these before any of the above):**
1. `python -m workers.run --ncua-only` — confirms NCUA URL + account codes work, derisks P1.
2. Use the platform yourself this week. Add a real broker. Send a real outreach. The friction you hit is the *real* next priority — these plans are abstract until you do.

---

## P0: Real backend (~3 days)

**Goal:** Replace browser localStorage with Supabase Postgres + Clerk auth + JSON export/import, so the operator can use the platform across devices without losing data.

**Files affected:** every client component that reads/writes `tradeline.*` localStorage keys (8 stores), every `lib/*.ts` storage helper, new `lib/db.ts`, new `app/api/sync/route.ts`.

### Tasks

**P0-1 — Stand up Supabase + Clerk** (~2 hours)
- **Action:** Create Supabase project on supabase.com. Add `DATABASE_URL` + `DIRECT_URL` to `.env.local` and Vercel. Install `@supabase/supabase-js` + `@clerk/nextjs`. Run `clerk dev` once to provision keys; add to env vars.
- **Read first:** `apps/web/package.json`, existing `apps/web/.env.local` (if present).
- **Acceptance:** `apps/web/lib/db.ts` exists with a typed `createClient()` helper; `npx supabase status` returns ok; a test query against `pg_version()` returns Postgres ≥ 15; Clerk sign-in page renders at `/sign-in`.

**P0-2 — Schema for all 8 stores** (~3 hours)
- **Action:** Write a single migration creating 8 tables: `customers`, `pipeline_deals`, `portfolio_holdings`, `compliance_licenses`, `contacts`, `bank_contacts`, `closings`, `collections`, `capital_config`, `approval_state`, `inbox_seen`. Every row has `user_id uuid not null references auth.users(id)` + `created_at` + `updated_at`. RLS policies: `user_id = auth.uid()` for select/insert/update/delete.
- **Read first:** `apps/web/lib/customers.ts`, `apps/web/app/app/pipeline/_pipeline-board.tsx` (Deal type), `apps/web/app/app/portfolio/_portfolio-board.tsx` (Holding type), `apps/web/lib/closings.ts`, `apps/web/lib/collections.ts`, `apps/web/lib/capital.ts`, `apps/web/lib/contacts.ts`, `apps/web/lib/bank-contacts.ts`.
- **Acceptance:** `supabase/migrations/0001_init.sql` exists; `supabase db push` succeeds; all 11 tables visible in dashboard; RLS enabled on every table (`select * from pg_policies` shows policies).

**P0-3 — Storage layer that mirrors writes to DB + falls back to localStorage** (~6 hours)
- **Action:** Rewrite each `lib/*.ts` reader/writer to async functions that call the DB when a user session exists, falling back to localStorage when unauthenticated. Pattern: `readCustomers()` → if `await getUser()` returns user, fetch from DB; else read localStorage. Same for writes (write to DB + mirror to localStorage). Wrap all storage modules: customers, closings, collections, capital, contacts, bank-contacts, inbox-history.
- **Read first:** the existing lib file being converted (one per task).
- **Acceptance:** every `lib/*.ts` storage module exports both sync (localStorage) AND async (DB-aware) read/write functions; existing callers continue to work via the sync path; a new test confirms DB writes round-trip when signed in.

**P0-4 — Migrate components to async storage on mount** (~4 hours)
- **Action:** Each board component (`CustomersBoard`, `PortfolioBoard`, `ClosingKit`, `RemittanceTracker`, `CapitalDeploymentTracker`, `OutreachSendForm`, `ApprovalInbox`) — update the `useEffect` that reads localStorage to also `await` the async DB read when signed in. Add a "Syncing…" state while the DB call is in flight. On localStorage-only data, show "Sign in to sync across devices" banner.
- **Read first:** `apps/web/app/app/customers/_customers-board.tsx`, `apps/web/app/app/portfolio/_portfolio-board.tsx`, `apps/web/app/app/portfolio/_remittance-tracker.tsx`, `apps/web/app/app/capital/_deployment-tracker.tsx`, `apps/web/app/app/pipeline/_closing-kit.tsx`, `apps/web/app/app/today/_approval-inbox.tsx`.
- **Acceptance:** signing in on a fresh browser shows the same data as the original session; refresh in incognito (signed out) shows the "Sign in to sync" banner; localStorage continues to work for unauthenticated reads.

**P0-5 — JSON export/import as backup** (~2 hours)
- **Action:** Add a `/app/settings` page (or extend `/app/profile`) with two buttons: **Export all** (dumps every `tradeline.*` localStorage key + every DB row scoped to user as one JSON file) and **Import** (file picker, dry-run preview, then write). Used as belt-and-suspenders even after DB exists.
- **Read first:** `apps/web/app/app/profile/page.tsx`.
- **Acceptance:** clicking Export downloads `tradeline-backup-{date}.json` containing all 11 stores; clicking Import on that same file restores state; round-trip preserves all data verifiably (file size + record count match).

---

## P1: NCUA verification + reply loop (~1 day)

**Goal:** Confirm the NCUA worker produces real signals, and surface inbound broker replies as inbox cards.

### Tasks

**P1-1 — Verify NCUA worker against real data** (~30 min)
- **Action:** From repo root, run `workers/.venv/bin/python -m workers.run --ncua-only`. Inspect the `[ncua]` log lines. If `credit_unions_scanned > 0` and `signals_seen > 0`, the URL + account codes work. If `0` on either, inspect the ZIP at `https://ncua.gov/files/publications/analysis/call-report-data-{YYYY}-{MM}.zip` for the actual file names and column headers, update `MASTER_FILE`/`FINANCIALS_FILE` constants in `workers/ncua.py` accordingly.
- **Read first:** `workers/ncua.py`, `workers/run.py`.
- **Acceptance:** `data/output/ncua_signals.jsonl` exists with ≥10 rows; each row has `cert`, `originator_name`, `signal_type`, `yoy_pct`, `period_label`.

**P1-2 — Resend inbound webhook handler** (~2 hours)
- **Action:** Add `apps/web/app/api/inbound-email/route.ts` that accepts Resend's inbound webhook payload, verifies the signature, extracts sender + body, calls the existing `/api/classify-reply` logic to bucket the reply (`interested` / `not_now` / `decline` / `unsubscribe`), and writes to a new `replies` table (or `tradeline.replies.v1` localStorage if pre-P0). Configure Resend dashboard to forward inbound to this endpoint.
- **Read first:** `apps/web/app/api/classify-reply/route.ts`, `apps/web/app/api/send-outreach/route.ts` (for the auth pattern).
- **Acceptance:** sending a test email to the Resend inbound address creates a row in `replies`; verified signature header is checked (rejects unsigned requests with 401).

**P1-3 — Inbox card for new replies** (~2 hours)
- **Action:** Extend `_local-proposals.ts` (or add a server-side `_proposals.ts` block once P0 is in) to read recent `replies` and emit a card per unread reply. Group: `outreach` (or a new `replies` group). Title: *"Reply from {sender} — {intent}"*. Body: first 500 chars of the reply. Primary action: link to the original deal or contact. On approve, mark the reply as `acknowledged`.
- **Read first:** `apps/web/app/app/today/_local-proposals.ts`, `apps/web/app/app/today/_approval-inbox.tsx`.
- **Acceptance:** an inbound email creates an inbox card within one render cycle; the card disappears when approved.

---

## P2: Bid write-back + Stripe links (~1 day)

**Goal:** Close the calculator → pipeline loop, and put real Stripe links in renewal cards.

### Tasks

**P2-1 — Calculator writes bid back to the deal** (~3 hours)
- **Action:** When the bid-calculator email composer is submitted (or a "Lock bid" button is clicked), POST `{ dealId, bidCentsPerDollar }` to a new `/api/deals/[id]/set-bid` route (P0 + DB) or directly write to `tradeline.pipeline.deals.v1` localStorage (pre-P0). Pass `dealId` through the existing deep-link query string already used by the calculator (`?ticker=...&face=...` — add `dealId`).
- **Read first:** `apps/web/app/app/tools/bid-calculator/calculator.tsx`, `apps/web/app/app/pipeline/_pipeline-board.tsx`.
- **Acceptance:** picking a bid in the calculator and clicking "Lock bid" updates `deal.bidCentsPerDollar` in the pipeline store; the inbox's P5 bid-recommendation card for that deal disappears on next refresh; the deal's stage auto-advances Reviewing/Underwriting → Bidding.

**P2-2 — Stripe Payment Links in renewal cards** (~3 hours)
- **Action:** Install `stripe` SDK. Add `apps/web/app/api/billing/payment-link/route.ts` that takes `{ customerId, plan }` and returns a Stripe Payment Link (using `stripe.paymentLinks.create`) with the customer's email pre-filled and metadata `{tradeline_customer_id, plan}`. In `_local-proposals.ts`, the customer-renewal card body should pre-fetch the link and embed it (`"Convert here: {link}"`) instead of "reply and I'll send the link."
- **Read first:** `apps/web/app/app/today/_local-proposals.ts` (customer-renewal block), `apps/web/lib/customers.ts`, `apps/web/lib/billing.ts`.
- **Acceptance:** a trial-customer's renewal card draft contains a `https://buy.stripe.com/...` link; clicking the link opens Stripe checkout pre-filled with the customer's email and the Solo plan.

---

## P3: Real estate / gov-contracting modules (~1–2 weeks each, deferred)

**Goal:** Extend the operator OS to two adjacent revenue surfaces.

**Deferred until:** debt-side revenue is recurring ($1k+/mo from SaaS subscribers OR a closed debt deal). Until then, don't fragment focus.

### Real estate module sketch
- New page `/app/properties` mirroring `/app/banks` UX
- New worker `workers/mls.py` + `workers/tax_liens.py` pulling distress signals from county tax-lien lists and MLS APIs
- Extend `_local-proposals.ts` with real-estate proposal types
- New `lib/property-model.ts` for ARV/cap-rate math (mirror of `lib/bid-model.ts`)

### Gov-contracting module sketch
- New page `/app/contracts` mirroring `/app/pipeline` UX
- New worker `workers/sam_gov.py` pulling SAM.gov RFP postings filtered to receivables-management NAICS codes
- New `lib/capability-statement.ts` to generate a one-pager from the user's `BuyerProfile` + closed deals

---

## P4: Tests + typed-route cleanup + observability (~2 days)

**Goal:** Production hygiene — kill the 158 latent TS errors, add tests for the math libs, wire error monitoring.

### Tasks

**P4-1 — Vitest on math libs** (~3 hours)
- **Action:** Install `vitest`. Add tests covering: `lib/bid-model.ts` (each asset class's disciplined-bid output matches hand-computed values), `lib/capital.ts` (over-commitment detection), `lib/collections.ts` (expectedFraction curve at boundary months, recoveryStatus labeling), `lib/closings.ts` (completedCount, isClosed).
- **Read first:** each lib file being tested.
- **Acceptance:** `npm test` exits 0 with ≥20 passing tests; coverage report shows ≥80% line coverage on the four math libs.

**P4-2 — Fix typed-route errors** (~2 hours)
- **Action:** Run `npx tsc --noEmit -p .` to list the 158 errors. They're all `<Link href="..."` with string literals that don't satisfy Next's typed-routes generic. Two fix options: (a) add `as Route` cast, (b) convert to plain `<a>`. Pick (a) for internal nav, (b) for external/dynamic URLs.
- **Read first:** `apps/web/next.config.ts` (confirm typedRoutes is enabled).
- **Acceptance:** `npx tsc --noEmit -p .` returns 0 errors; `npm run build` succeeds.

**P4-3 — Sentry wiring** (~1 hour)
- **Action:** Install `@sentry/nextjs`. Run `npx @sentry/wizard@latest -i nextjs`. Add `NEXT_PUBLIC_SENTRY_DSN` to env vars on Vercel. Filter out localStorage-quota errors (noisy, expected on small browsers).
- **Read first:** `apps/web/next.config.ts`.
- **Acceptance:** triggering a runtime error in dev shows up in the Sentry dashboard within 60s.

---

## P5: RAG tutor (~2–3 days)

**Goal:** AI tutor reads the operator's actual pipeline, closed deals, and outreach history — answers like *"what should I bid on this WAL tape"* using YOUR data, not just industry generic.

**Prereq:** P0 (real DB with the user's data queryable server-side).

### Tasks

**P5-1 — Embed user data on write** (~4 hours)
- **Action:** Add `pgvector` extension to Supabase. New table `embeddings(id, user_id, source_kind, source_id, content, embedding vector(1536))`. On every pipeline deal write, every closed deal write, every outreach send → generate embedding via OpenAI's text-embedding-3-small (cheap) and store. Use a queue (Vercel Cron + a `/api/embed` route) so writes aren't blocked on embedding latency.
- **Read first:** existing pipeline/portfolio/outreach write paths after P0 is done.
- **Acceptance:** writing a new pipeline deal produces a corresponding row in `embeddings` within 60s; querying via cosine similarity returns relevant past deals.

**P5-2 — Tutor RAG retrieval** (~3 hours)
- **Action:** Update `lib/tutor-llm.ts` to embed the user's question, run a vector search against the user's embeddings (top-5), and inject them into the prompt as `<user_context>` before calling Claude. Keep prompt caching on the system prompt; user context goes in the user turn.
- **Read first:** `apps/web/lib/tutor-llm.ts`, `apps/web/app/api/tutor/route.ts`.
- **Acceptance:** asking the tutor *"what's my biggest deal in pipeline right now"* returns an answer that references actual pipeline data by ticker; asking about a fictional ticker returns "I don't see that in your pipeline."

---

## How to use this plan

- Each task is sized to ship in one work session.
- Read-firsts are mandatory — they're what keeps the executor from making shallow assumptions about the existing code.
- Acceptance criteria are grep-checkable or runtime-verifiable, not subjective.
- Phases are ordered by what *protects the business*, not what's most fun.
- If a phase doesn't help you sell tradelines this quarter, defer it.

**To start P0 in a fresh session:** `/clear`, then paste *"Execute P0 from PLAN.md — start with P0-1."*
