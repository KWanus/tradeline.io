import "server-only";

import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HealthStatus = "ok" | "degraded" | "stale";

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

/**
 * Compact JSON health endpoint suitable for uptime monitors (UptimeRobot,
 * BetterUptime, Healthchecks.io). Always returns 200 with a structured
 * payload — the body's `status` field is what determines green/yellow/red
 * on the monitor side, so brief outages don't get amplified into noise.
 *
 * Public on purpose: the same JSON powers /status, which is a credibility
 * signal that the operator stands behind their infra.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: CheckResult[] = [];

  // Snapshot freshness
  let snapshotAgeHours: number | null = null;
  let banks = 0;
  let signals = 0;
  let snapshotGeneratedAt: string | null = null;
  try {
    const snap = await readSnapshot();
    snapshotGeneratedAt = snap.generated_at || null;
    if (snap.generated_at) {
      const ageMs = Date.now() - new Date(snap.generated_at).getTime();
      snapshotAgeHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;
    }
    banks = snap.originators?.length || 0;
    signals = snap.summary?.sec_signals_total || 0;
    checks.push({
      name: "snapshot",
      ok:
        snapshotAgeHours !== null &&
        snapshotAgeHours < 12 &&
        banks > 0,
      detail: snapshotAgeHours === null
        ? "no generated_at on snapshot"
        : `${snapshotAgeHours}h old, ${banks} banks`,
    });
  } catch (err) {
    checks.push({
      name: "snapshot",
      ok: false,
      detail: `failed to read: ${(err as Error).message}`,
    });
  }

  // Service configuration — boolean checks on env vars. We don't ping the
  // upstream APIs here because that would consume rate limits on every
  // monitor hit. Config presence is the right proxy: if the keys are set,
  // the worker code paths are armed.
  const services: Array<[string, boolean, string]> = [
    [
      "anthropic",
      Boolean(process.env.ANTHROPIC_API_KEY),
      "AI tutor + daily briefing + reply classifier",
    ],
    [
      "resend",
      Boolean(process.env.RESEND_API_KEY),
      "Welcome + weekly digest + outreach send",
    ],
    [
      "cron",
      Boolean(process.env.CRON_SECRET),
      "Monday auto-send via GitHub Actions",
    ],
    [
      "unsubscribe",
      Boolean(process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET),
      "Signed one-click unsubscribe links",
    ],
  ];
  for (const [name, ok, detail] of services) {
    checks.push({ name, ok, detail: ok ? detail : `not configured · ${detail}` });
  }

  // Overall status
  const snapshotCheck = checks.find((c) => c.name === "snapshot");
  const snapshotOk = snapshotCheck?.ok ?? false;
  const criticalOk = snapshotOk && (snapshotAgeHours === null || snapshotAgeHours < 24);
  const status: HealthStatus = !snapshotOk
    ? "stale"
    : !criticalOk
      ? "degraded"
      : "ok";

  const latencyMs = Date.now() - startedAt;
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || null;

  return NextResponse.json(
    {
      status,
      checks,
      stats: {
        banks,
        signals,
        snapshotAgeHours,
        snapshotGeneratedAt,
      },
      build: {
        sha: buildSha ? buildSha.slice(0, 7) : null,
        env: process.env.VERCEL_ENV || "local",
      },
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
