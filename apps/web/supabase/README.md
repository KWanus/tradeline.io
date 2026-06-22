# Supabase backend (PLAN P0)

This directory holds the database scaffolding that replaces browser
localStorage with a real Postgres backend so a browser wipe doesn't erase the
business and the operator can work across devices.

## Status

| Task | State |
|---|---|
| **P0-1** typed client (`lib/db.ts`) | ✅ written — dormant until env vars set |
| **P0-2** schema migration (`migrations/0001_init.sql`) | ✅ written — apply with `supabase db push` |
| **P0-3** async storage layer (DB write + localStorage fallback) | ⏳ needs a live DB to verify round-trips |
| **P0-4** migrate components to async-on-mount | ⏳ follows P0-3 |
| **P0-5** JSON export/import backup | ✅ already shipped (`/app/profile` → Export all / Import) |

The app builds and runs today on localStorage with **zero** infra. Nothing
below is required until you want cross-device sync.

## Wire-up

1. Create a project at supabase.com.
2. Add to `apps/web/.env.local` (and Vercel):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # server-only, never expose to the client
   ```
3. Apply the schema:
   ```
   supabase db push          # or paste migrations/0001_init.sql into the SQL editor
   ```
4. Verify: every table in `public` has RLS enabled
   (`select * from pg_policies;` shows four policies per table).

## Schema shape

Each localStorage store maps to one table. Collection stores
(`pipeline_deals`, `customers`, `closings`, …) hold many user-scoped rows keyed
by the store's own `app_id`; singleton stores (`capital_config`,
`approval_state`, `inbox_seen`) hold exactly one row per user. The store object
lives in a `jsonb data` column so the existing read/write helpers can adopt the
DB without reshaping their payloads — the async layer (P0-3) just swaps the
storage medium behind the same function signatures.

Every table:
- `user_id uuid not null references auth.users(id)`
- RLS: `user_id = auth.uid()` on select/insert/update/delete
- `created_at` / `updated_at` (auto-touched by trigger)
