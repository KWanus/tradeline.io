"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import { buildAiUserContext } from "@/lib/ai-context";
import { buildDynamicTutorPrompts } from "@/lib/activity-log";
import { readCapitalState } from "@/lib/capital";
import {
  licenseStatus,
  readLicenses,
  type License,
} from "@/lib/compliance-licenses";
import {
  buildReturnsReport,
  readReturns,
  type HoldingForReturns,
} from "@/lib/returns-tracker";

type Citation = { url: string; title?: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  searched?: boolean;
};

const STORAGE_KEY = "tradeline.tutor.messages.v1";

const PRACTICE_SCENARIOS: Array<{
  tag: string;
  label: string;
  detail: string;
  prompt: (ticker?: string, bank?: string, firm?: string) => string;
}> = [
  {
    tag: "Cold call",
    label: "Rehearse the broker call",
    detail: "AI role-plays a skeptical broker. You practice your pitch.",
    prompt: (ticker, bank, firm) =>
      `Switch to interactive role-play mode. You play the role of a senior debt broker at Garnet Capital (a real US NPL broker). I'm about to cold-call you about ${
        bank && ticker ? `${bank} (${ticker})` : "a regional bank's NPL portfolio"
      }. You're polite but skeptical of unknown buyers — you'll ask about my license, my state, my servicer, and my closing track record. Start the call now by answering "Garnet, [your-name] speaking." I'll respond as the buyer (firm: ${
        firm || "[Tradeline-buyer-firm]"
      }). Stay in character. After 5–7 exchanges or when I write "END ROLE-PLAY", break character and give me 3 specific things I did well + 3 things to improve.`,
  },
  {
    tag: "Email draft",
    label: "Draft a custom outreach email",
    detail: "AI writes a tailored email — different from the playbook template.",
    prompt: (ticker, bank) =>
      `Draft me a custom outreach email${
        bank && ticker
          ? ` to a debt broker about ${bank} (${ticker})`
          : ` to a debt broker about a specific bank — ask me which one first`
      }. Use my buyer profile. Make it different from the standard playbook template — vary the angle (could lead with the macro NPL trend, the specific signal, or a question). Keep it 4-6 lines, no jargon I haven't earned, ends with one concrete ask.`,
  },
  {
    tag: "Negotiation",
    label: "Negotiate a tape price",
    detail: "AI plays the seller. You practice counter-offers without losing the deal.",
    prompt: (ticker, bank) =>
      `Switch to role-play mode. You're the seller's broker. You're sending me a tape on ${
        bank && ticker
          ? `${bank} (${ticker})`
          : "a $5M-face credit-card portfolio"
      } and we're negotiating price. You ask 5.5¢/$ to start; you can move to ~4¢ but won't go below. I'll counter with bid math using my actual recovery model. Stay in character. After we reach a price (or walk away), coach me on whether I pushed at the right moments and whether my justifications held up.`,
  },
];

const SUGGESTED_QUESTIONS = [
  "I&rsquo;m new to debt buying. What do I need to do first?",
  "Should I start in Georgia, Virginia, or Maryland?",
  "What does a 5¢/$ bid actually mean? Walk me through one.",
  "How long until I can hypothecate my first portfolio?",
  "Find any new CFPB guidance for debt buyers from the last 3 months.",
  "What are competitors charging for debt-buyer SaaS like Tradeline?",
];

function loadHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Message[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: Message[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

// Render assistant text with /app/* paths as inline links and **bold** as <strong>.
function renderRich(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Split on /app/* tokens and **bold** runs in one regex pass per line
  const lines = text.split("\n");
  lines.forEach((line, lineIdx) => {
    // Inline tokenizer
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let cursor = 0;
    const re = /(\*\*[^*]+\*\*|\/app\/[a-z0-9/_\-\[\]]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      if (match.index > cursor) {
        tokens.push(line.slice(cursor, match.index));
      }
      const tok = match[0];
      if (tok.startsWith("**") && tok.endsWith("**")) {
        tokens.push(
          <strong key={`b-${lineIdx}-${match.index}`} className="text-[color:var(--color-fg)]">
            {tok.slice(2, -2)}
          </strong>
        );
      } else if (tok.startsWith("/app/")) {
        // Strip trailing punctuation that the regex over-matched
        const cleaned = tok.replace(/[.,);]+$/, "");
        const trailing = tok.slice(cleaned.length);
        tokens.push(
          <a
            key={`l-${lineIdx}-${match.index}`}
            href={cleaned}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            {cleaned}
          </a>
        );
        if (trailing) tokens.push(trailing);
      }
      cursor = match.index + tok.length;
      remaining = line.slice(cursor);
    }
    if (cursor < line.length) tokens.push(line.slice(cursor));

    out.push(
      <span key={`line-${lineIdx}`}>
        {tokens.length > 0 ? tokens : line}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
  return out;
}

export function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [profile] = useBuyerProfile();
  const searchParams = useSearchParams();
  const endRef = useRef<HTMLDivElement>(null);

  const bankContext = useMemo(() => {
    const ticker = searchParams?.get("ticker");
    const bank = searchParams?.get("bank");
    const signal = searchParams?.get("signal");
    const yoy = searchParams?.get("yoy");
    if (!ticker) return null;
    return {
      ticker,
      bank: bank || ticker,
      signal: signal || null,
      yoy: yoy ? Number(yoy) : null,
    };
  }, [searchParams]);

  // Dynamic prompts derived from operator's recent activity + spine
  // state. Only computed after hydration so localStorage reads are safe.
  const dynamicPrompts = useMemo<string[]>(() => {
    if (!hydrated) return [];
    try {
      const licenses: License[] = readLicenses();
      const activeLicenses = licenses.filter((l) => licenseStatus(l) !== "expired");
      // Capital over-commit
      let overCommitted = false;
      try {
        const cap = readCapitalState();
        overCommitted = cap.configured && cap.available < 0;
      } catch {}
      // Urgent returns count
      let urgentReturnsCount = 0;
      try {
        const returnsRecords = readReturns();
        if (returnsRecords.length > 0) {
          const holdingsRaw = window.localStorage.getItem(
            "tradeline.portfolio.holdings.v1"
          );
          const raws = holdingsRaw ? (JSON.parse(holdingsRaw) || []) : [];
          const holdingsById = new Map<string, HoldingForReturns>();
          for (let i = 0; i < raws.length; i++) {
            const h = raws[i] as {
              id?: string;
              ticker?: string;
              seller?: string;
              faceValueUsd?: number;
              purchasePriceUsd?: number;
              purchaseDate?: string;
            };
            const id = String(h.id ?? `h${i}`);
            holdingsById.set(id, {
              id,
              ticker: String(h.ticker ?? ""),
              seller: String(h.seller ?? ""),
              faceValueUsd: Number(h.faceValueUsd) || 0,
              purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
              purchaseDate: String(h.purchaseDate ?? ""),
            });
          }
          const report = buildReturnsReport(returnsRecords, holdingsById);
          urgentReturnsCount = report.urgentReturns.length;
        }
      } catch {}
      return buildDynamicTutorPrompts({
        activeLicenses,
        urgentReturnsCount,
        capitalOverCommitted: overCommitted,
      });
    } catch {
      return [];
    }
  }, [hydrated]);

  const [researchMode, setResearchMode] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tradeline.tutor.research_mode");
      if (stored === "1") setResearchMode(true);
    } catch {}
  }, []);
  const toggleResearch = () => {
    setResearchMode((r) => {
      const next = !r;
      try {
        window.localStorage.setItem(
          "tradeline.tutor.research_mode",
          next ? "1" : "0"
        );
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, hydrated]);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text || loading) return;
    setError(null);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const combinedContext = buildAiUserContext(profile, bankContext);
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          userContext: combinedContext,
          enableResearch: researchMode,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        if (data?.enabled === false) setEnabled(false);
        return;
      }
      if (data.enabled === false) {
        setEnabled(false);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text || "",
          citations: Array.isArray(data.citations) ? data.citations : [],
          searched: !!data.searched,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    if (!confirm("Clear all chat history?")) return;
    setMessages([]);
    setError(null);
  }

  function exportMarkdown() {
    if (messages.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const hostname =
      typeof window !== "undefined" ? window.location.hostname || "local" : "local";
    const lines: string[] = [];
    lines.push(`# Tradeline tutor — ${stamp}`);
    lines.push(`${messages.length} message${messages.length === 1 ? "" : "s"} · exported from ${hostname}`);
    lines.push("");
    for (const m of messages) {
      lines.push(m.role === "user" ? "## You" : "## Tutor");
      lines.push("");
      lines.push(m.content.trim());
      lines.push("");
      if (m.role === "assistant" && m.citations && m.citations.length > 0) {
        const cited = m.citations
          .map((c, i) => `[${i + 1}] ${c.title || c.url} — ${c.url}`)
          .join("\n");
        lines.push("> **Sources**");
        lines.push("> ");
        for (const c of cited.split("\n")) lines.push(`> ${c}`);
        lines.push("");
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeline-tutor-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return (
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
        Loading tutor…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          AI tutor disabled
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The AI tutor needs an Anthropic API key on the server to run. Set{" "}
          <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
            ANTHROPIC_API_KEY
          </code>{" "}
          in <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
            apps/web/.env.local
          </code>{" "}
          and restart the dev server.
        </p>
        <pre className="mt-3 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-3 font-mono text-[12px] text-[color:var(--color-fg-dim)] overflow-x-auto">
{`echo 'ANTHROPIC_API_KEY=sk-ant-api03-...' >> apps/web/.env.local`}
        </pre>
      </div>
    );
  }

  const profileComplete = isProfileComplete(profile);

  return (
    <div className="space-y-6">
      {bankContext && (
        <div className="rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13px] text-[color:var(--color-fg)] leading-snug">
              <strong>From bank detail:</strong> {bankContext.bank} ({bankContext.ticker})
              {bankContext.signal && (
                <>
                  {" "}— <em>{bankContext.signal}</em>
                  {bankContext.yoy ? ` (+${bankContext.yoy}% YoY)` : ""}
                </>
              )}
              . The tutor knows this context — ask "draft the email" or "rehearse the call" and it'll use it.
            </div>
            <Link
              href={`/app/banks/${bankContext.ticker}`}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-bg)] transition"
            >
              Back to bank →
            </Link>
          </div>
          {messages.length === 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[color:var(--color-fg-dim)]">Quick start:</span>
              {[
                `Rehearse the broker call for ${bankContext.ticker}`,
                `Draft the outreach email for ${bankContext.ticker}`,
                `What objections should I expect for ${bankContext.ticker}?`,
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-bg)] transition"
                >
                  {q.replace(`for ${bankContext.ticker}`, "")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={`rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap ${
          profileComplete
            ? "border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]"
            : "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2 h-2 rounded-full ${
              profileComplete ? "bg-[color:var(--color-accent)] glow" : "bg-[color:var(--color-fg-faint)]"
            }`}
          />
          <span className="text-[13px] text-[color:var(--color-fg-dim)]">
            {profileComplete ? (
              <>
                Tutor knows: <strong className="text-[color:var(--color-fg)]">{profile.firmName}</strong>
                {profile.state ? <>, {profile.state} licensed</> : null}
                {profile.assetFocus ? <>, focused on {profile.assetFocus}</> : null}.
              </>
            ) : (
              <>Tutor doesn&rsquo;t know who you are yet. Fill profile for personalized answers.</>
            )}
          </span>
        </div>
        <Link
          href="/app/profile"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          {profileComplete ? "Edit" : "Fill →"}
        </Link>
      </div>

      {messages.length === 0 ? (
        <section className="space-y-6">
          {/* Practice scenarios — interactive role-plays */}
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-3">
              Practice · interactive role-play
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {PRACTICE_SCENARIOS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => sendMessage(p.prompt(bankContext?.ticker, bankContext?.bank, profile.firmName))}
                  className="text-left p-4 rounded-xl transition"
                  style={{
                    background:
                      "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                    border: "1.5px solid transparent",
                  }}
                >
                  <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                    {p.tag}
                  </div>
                  <div className="mt-1.5 font-semibold text-[18px] text-[color:var(--color-fg)] leading-tight">
                    {p.label}
                  </div>
                  <div className="mt-1.5 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
                    {p.detail}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-[color:var(--color-fg-faint)]">
              {bankContext
                ? `Tradeline AI will use ${bankContext.ticker} context automatically.`
                : "Open a bank detail page first to pre-load the ticker, or just start — AI will ask."}
            </p>
          </div>

          {/* Dynamic prompts — derived from your recent activity + spine state */}
          {dynamicPrompts.length > 0 && (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-accent)] uppercase">
                  About your recent activity
                </span>
                <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                  derived from your last 200 actions + spine state
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {dynamicPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendMessage(p)}
                    className="text-left text-[14px] text-[color:var(--color-fg)] rounded-lg p-4 transition hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                      border: "1.5px solid transparent",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge questions */}
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-3">
              Or ask anything
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => {
                const plain = q.replace(/&rsquo;/g, "'");
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(plain)}
                    className="text-left text-[14px] text-[color:var(--color-fg-dim)] border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] rounded-lg p-4 hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-fg)] transition"
                    dangerouslySetInnerHTML={{ __html: q }}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`border ${
                m.role === "user"
                  ? "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
                  : "border-[color:var(--color-accent-dim)] bg-[color:var(--color-bg-1)]"
              } p-5`}
            >
              <div
                className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 ${
                  m.role === "user"
                    ? "text-[color:var(--color-fg-faint)]"
                    : "text-[color:var(--color-accent)]"
                }`}
              >
                <span>{m.role === "user" ? "You" : "Tradeline AI"}</span>
                {m.searched && (
                  <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] border border-[color:var(--color-line)] rounded px-1.5 py-0.5">
                    web searched
                  </span>
                )}
              </div>
              <div className="text-[14px] text-[color:var(--color-fg)] leading-relaxed whitespace-pre-wrap">
                {renderRich(m.content)}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[color:var(--color-line)]">
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
                    Sources
                  </div>
                  <ul className="space-y-1">
                    {m.citations.map((c) => (
                      <li key={c.url} className="text-[12px] text-[color:var(--color-fg-dim)] truncate">
                        →{" "}
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[color:var(--color-accent)] hover:underline"
                        >
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
              <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-accent)] uppercase">
                Tutor is thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-4 text-[14px] text-[color:var(--color-danger)]">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-4"
      >
        <div className="flex items-stretch gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            rows={2}
            placeholder={
              researchMode
                ? "Ask anything · web search enabled · Enter to send"
                : "Ask anything — Enter to send, Shift+Enter for newline"
            }
            className="flex-1 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[14px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition resize-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || input.trim().length === 0}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 disabled:opacity-40 transition self-end"
          >
            {loading ? "Thinking…" : "Send"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={toggleResearch}
            title="When on, the assistant can search the web for current industry info, regulatory updates, and competitor offerings."
            className={`flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border transition ${
              researchMode
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                researchMode ? "bg-[color:var(--color-accent)] glow" : "bg-[color:var(--color-fg-faint)]"
              }`}
            />
            Research mode {researchMode ? "on" : "off"}
          </button>
          <span className="text-[11px] text-[color:var(--color-fg-faint)] leading-snug">
            {researchMode
              ? "Web search on. Use it for current pricing, new regs, competitor research."
              : "Off-line only. Toggle on for live web search."}
          </span>
        </div>
      </form>

      {messages.length > 0 && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={exportMarkdown}
            title="Download this conversation as a .md file for journaling or sharing"
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Export .md
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear chat
          </button>
        </div>
      )}
    </div>
  );
}
