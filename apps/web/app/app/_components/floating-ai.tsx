"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";

const STORAGE_KEY = "tradeline.floating_ai.messages.v1";

type Message = { role: "user" | "assistant"; content: string; ts: number };
type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "disabled"; message: string }
  | { kind: "error"; message: string };

function read(): Message[] {
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

function write(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    // Cap to last 30 turns so localStorage doesn't grow forever.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {}
}

function pageNiceLabel(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/today") return "your daily workbase";
  if (pathname.startsWith("/app/banks/")) {
    const t = pathname.split("/")[3];
    return `bank ${t?.toUpperCase() || ""}`.trim();
  }
  const slug = pathname.replace(/^\/app\//, "").split("/")[0] || "today";
  return slug.replace(/-/g, " ");
}

export function FloatingAi() {
  const pathname = usePathname() || "";
  const [profile] = useBuyerProfile();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Hide entirely on full tutor page (it has its own chat).
  const onTutorPage = pathname.startsWith("/app/tutor");

  useEffect(() => setMessages(read()), []);

  useEffect(() => {
    if (!open) return;
    // Scroll to bottom when opening or new messages land.
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (onTutorPage) return null;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || state.kind === "sending") return;

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    write(next);
    setInput("");
    setState({ kind: "sending" });

    // Build a small user-context blob with profile + current page so the LLM
    // answers in the right voice and frame.
    const profileLines = [
      profile.firmName && `Firm: ${profile.firmName}`,
      profile.state && `State: ${profile.state}`,
      profile.assetFocus && `Asset focus: ${profile.assetFocus}`,
      profile.servicer && `Servicer: ${profile.servicer}`,
      profile.ticketRange && `Typical ticket: ${profile.ticketRange}`,
    ]
      .filter(Boolean)
      .join("\n");
    const userContext = [
      `User is on page: ${pathname} (${pageNiceLabel(pathname)}).`,
      profileLines ? `User profile:\n${profileLines}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          userContext,
          enableResearch: false,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setState({ kind: "disabled", message: data.message });
        return;
      }
      if (!r.ok || data.error) {
        setState({ kind: "error", message: data.error || `HTTP ${r.status}` });
        return;
      }
      const reply: Message = {
        role: "assistant",
        content: data.text || "(empty reply)",
        ts: Date.now(),
      };
      const final = [...next, reply];
      setMessages(final);
      write(final);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  const clearChat = () => {
    setMessages([]);
    write([]);
    setState({ kind: "idle" });
  };

  return (
    <>
      {/* Trigger pill — same visual as before */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 md:bottom-7 md:right-7 z-40 group inline-flex items-center gap-2.5 px-4 py-3 rounded-full text-[13px] font-medium text-[#1a0c00] shadow-[0_14px_38px_-10px_rgba(236,72,153,0.55),0_0_0_1px_rgba(245,166,35,0.4)] hover:shadow-[0_18px_44px_-8px_rgba(236,72,153,0.7),0_0_0_1px_rgba(245,166,35,0.6)] transition-all hover:-translate-y-0.5"
          style={{ background: "var(--gradient-primary)" }}
          aria-label="Ask Tradeline AI"
        >
          <span className="w-2 h-2 rounded-full bg-[#fff8e8]" />
          <span>Ask Tradeline AI</span>
          <span className="opacity-70 group-hover:opacity-100 transition">✦</span>
        </button>
      )}

      {open && (
        <>
          {/* Backdrop — click to close on mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:bg-transparent md:pointer-events-none"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <aside
            className="fixed bottom-0 right-0 z-50 w-full md:w-[400px] md:bottom-5 md:right-5 md:rounded-2xl bg-[color:var(--color-bg-1)] border-t md:border border-[color:var(--color-line-strong)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] flex flex-col"
            style={{ height: "min(620px, 80vh)" }}
            role="dialog"
            aria-label="Tradeline AI"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[color:var(--color-line)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: "var(--gradient-primary)" }}
                  />
                  <span className="text-[13px] font-medium text-[color:var(--color-fg)]">
                    Tradeline AI
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[color:var(--color-fg-faint)] truncate">
                  Reading context from {pageNiceLabel(pathname)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
                    title="Clear chat"
                  >
                    Clear
                  </button>
                )}
                <Link
                  href="/app/tutor"
                  className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition"
                  title="Open full tutor"
                >
                  Expand ↗
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-1 px-2 py-1 rounded text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-bg-2)] transition"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px] leading-relaxed"
            >
              {messages.length === 0 ? (
                <div className="text-[12px] text-[color:var(--color-fg-dim)] space-y-3">
                  <p>
                    Ask anything. I have context on{" "}
                    <span className="text-[color:var(--color-fg)]">
                      {pageNiceLabel(pathname)}
                    </span>{" "}
                    and your buyer profile, so answers come back in your voice.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <SuggestBtn text="What's my single most important next action?" onClick={(t) => setInput(t)} />
                    <SuggestBtn text="Draft a follow-up email to a broker who hasn't replied" onClick={(t) => setInput(t)} />
                    <SuggestBtn text="Walk me through the next 30 days as a licensed buyer" onClick={(t) => setInput(t)} />
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <Bubble key={i} role={m.role} content={m.content} />
                ))
              )}
              {state.kind === "sending" && (
                <Bubble role="assistant" content="…" />
              )}
              {state.kind === "error" && (
                <div className="text-[11px] text-[color:var(--color-danger)]">
                  {state.message}
                </div>
              )}
              {state.kind === "disabled" && (
                <div className="text-[11px] text-[color:var(--color-warn)] leading-relaxed">
                  {state.message}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={submit}
              className="border-t border-[color:var(--color-line)] p-3 flex items-end gap-2"
            >
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask about this page, or anything…"
                className="flex-1 resize-none px-3 py-2 rounded-md bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || state.kind === "sending"}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                {state.kind === "sending" ? "…" : "Ask"}
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap ${
          role === "user"
            ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-fg)] rounded-br-sm"
            : "bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function SuggestBtn({
  text,
  onClick,
}: {
  text: string;
  onClick: (t: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="text-left text-[12px] text-[color:var(--color-fg)] bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition rounded-md px-3 py-2"
    >
      {text}
    </button>
  );
}
