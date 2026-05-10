"use client";

import Link from "next/link";
import { useState } from "react";
import { fillTemplate, isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

type CallLine = { line: string; you: string; coach?: string };
type EmailTemplate = { scenario: string; subject: string; body: string };
type Objection = { objection: string; response: string };

export function PlaybookProfileBadge() {
  const [profile] = useBuyerProfile();
  const complete = isProfileComplete(profile);

  return (
    <div
      className={`mb-8 rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap ${
        complete
          ? "border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            complete ? "bg-[color:var(--color-accent)] glow" : "bg-[color:var(--color-warn)]"
          }`}
        />
        <span className="text-[13px] text-[color:var(--color-fg)]">
          {complete ? (
            <>
              <strong>Scripts and emails below are auto-filled with your firm info.</strong>{" "}
              Copy and edit names before sending.
            </>
          ) : (
            <>
              <strong>Your profile is empty</strong> — scripts and emails below show
              placeholders like <code className="font-mono text-[11px] text-[color:var(--color-fg-dim)]">[your firm]</code>.
              Fill it once to auto-fill every template here.
            </>
          )}
        </span>
      </div>
      <Link
        href="/app/profile"
        className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
      >
        {complete ? "Edit profile" : "Fill profile →"}
      </Link>
    </div>
  );
}

export function FirstCallScripts({ lines }: { lines: CallLine[] }) {
  const [profile] = useBuyerProfile();

  return (
    <div className="space-y-4">
      {lines.map((f, i) => (
        <div key={i} className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
            {f.line}
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed italic">
            &ldquo;{fillTemplate(f.you, profile)}&rdquo;
          </p>
          {f.coach && (
            <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
              <span className="text-[color:var(--color-warn)]">Why:</span> {f.coach}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function EmailTemplates({ emails }: { emails: EmailTemplate[] }) {
  const [profile] = useBuyerProfile();
  const [copied, setCopied] = useState<number | null>(null);

  const copy = async (i: number, e: EmailTemplate) => {
    const subj = fillTemplate(e.subject, profile);
    const body = fillTemplate(e.body, profile);
    try {
      await navigator.clipboard.writeText(`Subject: ${subj}\n\n${body}`);
      setCopied(i);
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {emails.map((e, i) => {
        const subj = fillTemplate(e.subject, profile);
        const body = fillTemplate(e.body, profile);
        return (
          <details
            key={i}
            className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] [&[open]>summary]:border-b group overflow-hidden"
          >
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between font-mono text-[12px] tracking-[0.18em] text-[color:var(--color-fg)] uppercase border-b border-transparent hover:bg-[color:var(--color-bg-2)] transition">
              <span>{e.scenario}</span>
              <span className="text-[color:var(--color-fg-faint)] group-open:rotate-90 inline-block transition-transform">
                &rarr;
              </span>
            </summary>
            <div className="p-5 border-[color:var(--color-line)]">
              <div className="font-mono text-[11px] text-[color:var(--color-fg-faint)] mb-2">
                <span className="text-[color:var(--color-fg-dim)]">Subject:</span> {subj}
              </div>
              <pre className="bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded p-4 font-mono text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed whitespace-pre-wrap">
                {body}
              </pre>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => copy(i, e)}
                  className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                >
                  {copied === i ? "Copied ✓" : "Copy email"}
                </button>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function Objections({ items }: { items: Objection[] }) {
  const [profile] = useBuyerProfile();

  return (
    <div className="space-y-3">
      {items.map((o, i) => (
        <div key={i} className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
          <div className="text-[14px] text-[color:var(--color-warn)] italic">{o.objection}</div>
          <div className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {fillTemplate(o.response, profile)}
          </div>
        </div>
      ))}
    </div>
  );
}
