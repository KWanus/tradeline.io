"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";
import { buildAiUserContext } from "@/lib/ai-context";

type Citation = { url: string; title?: string };

type CachedBriefing = {
  date: string; // YYYY-MM-DD
  text: string;
  citations: Citation[];
  searched: boolean;
};

type RadarSummary = {
  totalBanks: number;
  strongTickers: string[];
  watchingCount: number;
  topSignalLabels: string[];
};

const CACHE_KEY = "tradeline.briefing.cache.v1";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCache(): CachedBriefing | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBriefing;
    if (parsed && parsed.date === todayKey() && parsed.text) return parsed;
  } catch {}
  return null;
}

function writeCache(b: CachedBriefing): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {}
}

/** Render text into JSX, splitting on the four ## section headers and
 *  auto-linking /app/ paths and http(s) URLs inside the body. */
function renderBriefing(text: string) {
  const sections = text.split(/\n(?=##\s)/).filter(Boolean);
  return sections.map((section, i) => {
    const headerMatch = section.match(/^##\s+(.+)$/m);
    const header = headerMatch?.[1]?.trim() || "";
    const body = section.replace(/^##\s+.+$/m, "").trim();
    return (
      <div key={i} className={i > 0 ? "mt-4" : undefined}>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)] mb-1.5">
          {header}
        </div>
        <div className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed whitespace-pre-wrap">
          {linkify(body)}
        </div>
      </div>
    );
  });
}

function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, lineIdx) => {
    const tokens: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\/app\/[a-z0-9/_\-\[\]]+|https?:\/\/[^\s)]+)/gi;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > cursor) tokens.push(line.slice(cursor, m.index));
      const tok = m[0];
      if (tok.startsWith("**") && tok.endsWith("**")) {
        tokens.push(
          <strong key={`b${lineIdx}-${m.index}`} className="text-[color:var(--color-fg)]">
            {tok.slice(2, -2)}
          </strong>
        );
      } else if (tok.startsWith("/app/")) {
        const cleaned = tok.replace(/[.,);]+$/, "");
        const trail = tok.slice(cleaned.length);
        tokens.push(
          <Link
            key={`a${lineIdx}-${m.index}`}
            href={cleaned}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            {cleaned}
          </Link>
        );
        if (trail) tokens.push(trail);
      } else {
        const cleaned = tok.replace(/[.,);]+$/, "");
        const trail = tok.slice(cleaned.length);
        tokens.push(
          <a
            key={`u${lineIdx}-${m.index}`}
            href={cleaned}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-accent)] hover:underline break-words"
          >
            {cleaned}
          </a>
        );
        if (trail) tokens.push(trail);
      }
      cursor = m.index + tok.length;
    }
    if (cursor < line.length) tokens.push(line.slice(cursor));
    out.push(
      <span key={`l${lineIdx}`}>
        {tokens.length > 0 ? tokens : line}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
  return out;
}

// Operator-level opt-out for auto-fire on first visit each day. When
// disabled, the briefing only generates on explicit click. Persists
// across visits.
const AUTO_FIRE_OPT_OUT_KEY = "tradeline.briefing.auto-fire-opt-out.v1";

function readAutoFireOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_FIRE_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAutoFireOptOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optedOut) {
      window.localStorage.setItem(AUTO_FIRE_OPT_OUT_KEY, "1");
    } else {
      window.localStorage.removeItem(AUTO_FIRE_OPT_OUT_KEY);
    }
  } catch {}
}

export function DailyBriefing({ radar }: { radar: RadarSummary }) {
  const [profile] = useBuyerProfile();
  const [briefing, setBriefing] = useState<CachedBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [researchMode, setResearchMode] = useState(true);
  const [autoFireOptOut, setAutoFireOptOut] = useState(false);

  const radarContext = useMemo(() => {
    const parts = [
      `Total banks tracked: ${radar.totalBanks}`,
      `Strong-signal banks today (${radar.strongTickers.length}): ${radar.strongTickers.join(", ") || "none"}`,
      `Watching: ${radar.watchingCount}`,
    ];
    if (radar.topSignalLabels.length > 0) {
      parts.push(`Top signal types today: ${radar.topSignalLabels.join("; ")}`);
    }
    return parts.join("\n");
  }, [radar]);

  // Try to load from cache on mount; auto-fire generate() on first visit
  // each day so the briefing becomes a real morning ritual instead of an
  // opt-in click that gets skipped. Cache prevents repeat LLM spend
  // within the same day. Operator can opt out via the Auto button.
  useEffect(() => {
    const optedOut = readAutoFireOptOut();
    setAutoFireOptOut(optedOut);
    const cached = readCache();
    if (cached) {
      setBriefing(cached);
      return;
    }
    if (!optedOut) {
      // Defer one tick so generate runs after initial render; avoids
      // SSR-mismatch concerns and lets the cache check finish first.
      const handle = setTimeout(() => {
        generate();
      }, 0);
      return () => clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const userContext = buildAiUserContext(profile, null);
      const r = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext,
          radarContext,
          enableResearch: researchMode,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setDisabled(true);
        return;
      }
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      const next: CachedBriefing = {
        date: todayKey(),
        text: data.text || "",
        citations: Array.isArray(data.citations) ? data.citations : [],
        searched: !!data.searched,
      };
      setBriefing(next);
      writeCache(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (disabled) {
    // Render nothing — the tutor page already shows the disabled state and how to fix.
    return null;
  }

  return (
    <section className="mb-12">
      <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-7">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Tradeline AI · daily briefing
            </div>
            <h2 className="mt-1 font-semibold text-2xl text-[color:var(--color-fg)] tracking-tight">
              Your 30-second read.
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const next = !autoFireOptOut;
                setAutoFireOptOut(next);
                writeAutoFireOptOut(next);
              }}
              title="When on, the briefing auto-generates on first visit each day. Cache prevents repeat LLM spend within the same day."
              className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border transition ${
                !autoFireOptOut
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                  !autoFireOptOut
                    ? "bg-[color:var(--color-accent)] glow"
                    : "bg-[color:var(--color-fg-faint)]"
                }`}
              />
              Auto {!autoFireOptOut ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => setResearchMode((v) => !v)}
              title="When on, the briefing can search the web for fresh industry news"
              className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border transition ${
                researchMode
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                  researchMode
                    ? "bg-[color:var(--color-accent)] glow"
                    : "bg-[color:var(--color-fg-faint)]"
                }`}
              />
              Research {researchMode ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 disabled:opacity-40 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading
                ? "Generating…"
                : briefing
                  ? "Regenerate"
                  : "Generate today's briefing"}
            </button>
          </div>
        </div>

        {!briefing && !loading && !error && (
          <p className="text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Tradeline AI synthesizes your pipeline + watchlist + radar + (with
            Research on) the last 24h of NPL industry news into one 4-section
            briefing. Cached locally — generates fresh once per day. Click{" "}
            <strong>Generate today&rsquo;s briefing</strong> to start.
          </p>
        )}

        {loading && (
          <div className="text-[13px] text-[color:var(--color-fg-dim)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)] glow animate-ping" />
            {researchMode ? "Searching the web + synthesizing…" : "Synthesizing your state…"}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-bg-soft)] p-3 text-[13px] text-[color:var(--color-danger)]">
            {error}
          </div>
        )}

        {briefing && !loading && (
          <div>
            {briefing.searched && (
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-3">
                · Web searched · cached for today
              </div>
            )}
            {renderBriefing(briefing.text)}
            {briefing.citations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[color:var(--color-line)]">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
                  Sources
                </div>
                <ul className="space-y-1">
                  {briefing.citations.map((c) => (
                    <li key={c.url} className="text-[12px] text-[color:var(--color-fg-dim)]">
                      →{" "}
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[color:var(--color-accent)] hover:underline break-words"
                      >
                        {c.title || c.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
