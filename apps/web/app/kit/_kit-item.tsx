"use client";

import { useState } from "react";

type Props = {
  label: string;
  description: string;
  content: string;
  /** Render the content with subject-line treatment if it starts with "Subject:". */
  isEmail?: boolean;
};

export function KitItem({ label, description, content, isEmail }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers: select the textarea and ask the user to Cmd+C.
      const el = document.getElementById(
        `kit-${slug(label)}-content`
      ) as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }

  // For email-style content, render the subject line in a chip above the body
  // so it's visually distinct and easy to copy independently if needed.
  const [subject, body] =
    isEmail && content.startsWith("Subject:")
      ? splitSubject(content)
      : [null, content];

  return (
    <article className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-xl tracking-tight italic text-[color:var(--color-fg)]">
          {label}
        </h2>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition shrink-0"
          style={{ background: "var(--gradient-primary)" }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {description}
      </p>

      {subject && (
        <div className="mt-4 rounded-md border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-2)] px-3 py-2 font-mono text-[12px] text-[color:var(--color-fg)]">
          {subject}
        </div>
      )}

      <textarea
        id={`kit-${slug(label)}-content`}
        readOnly
        value={body}
        rows={Math.min(14, body.split("\n").length + 1)}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        className="mt-3 w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 font-mono text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition leading-relaxed"
      />
    </article>
  );
}

function splitSubject(content: string): [string, string] {
  // Take the first line as the subject, drop the leading "Subject: " prefix.
  const newlineIdx = content.indexOf("\n");
  if (newlineIdx === -1) return [content, ""];
  const subjectLine = content.slice(0, newlineIdx).trim();
  const subject = subjectLine.replace(/^Subject:\s*/i, "");
  // Skip the blank line if any, then the body.
  let rest = content.slice(newlineIdx + 1);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return [`Subject: ${subject}`, rest];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
