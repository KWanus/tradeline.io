import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory (PLAN P0-1).
 *
 * The operator-OS is single-tenant and localStorage-backed today; this is the
 * server-side door to the Postgres backend that replaces it (P0-3/P0-4). It's
 * intentionally dormant until the env vars are set, so the app builds and runs
 * with $0 infra and degrades to localStorage when the DB isn't configured.
 *
 * Env vars (set in .env.local + Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL       — project URL
 *   SUPABASE_SERVICE_ROLE_KEY      — server-only, bypasses RLS (never ship to client)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — browser client, RLS-enforced
 */

let _service: SupabaseClient | null = null;

/** True when both URL + service-role key are present. */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Server-side client using the service-role key. Bypasses RLS — only call from
 * trusted server code (route handlers, server actions) and always scope queries
 * by user_id yourself. Returns null when the DB isn't configured so callers can
 * fall back to localStorage.
 */
export function getServiceClient(): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _service;
}

/**
 * Create a request-scoped client bound to a signed-in user's access token, so
 * RLS policies (`user_id = auth.uid()`) apply. Pass the JWT from the auth
 * provider (Supabase Auth or a Clerk → Supabase template). Returns null when
 * the anon key isn't configured.
 */
export function getUserClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
