"use client";

import Link from "next/link";
import { buildBuyerProfileSheet, isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import { useState } from "react";

const FIELDS: Array<{
  key: keyof ReturnType<typeof useBuyerProfile>[0];
  label: string;
  placeholder: string;
  hint?: string;
  full?: boolean;
}> = [
  { key: "yourName", label: "Your name", placeholder: "Jane Doe", hint: "How you sign emails." },
  { key: "firmName", label: "Firm name", placeholder: "Tradeline Capital LLC", hint: "Your LLC or corporation." },
  { key: "state", label: "License state", placeholder: "VA", hint: "The state where you hold your debt-buyer license." },
  { key: "licenseNumber", label: "License number", placeholder: "DBC-12345", hint: "From your state filing paperwork." },
  { key: "bondCarrier", label: "Bond carrier", placeholder: "Hiscox", hint: "Who issued your surety bond." },
  { key: "bondAmount", label: "Bond amount", placeholder: "$25,000", hint: "Required amount varies by state ($5k–$50k)." },
  { key: "servicer", label: "Servicer", placeholder: "NCB Management Services", hint: "Who collects on your behalf." },
  { key: "assetFocus", label: "Asset focus", placeholder: "credit card, consumer", hint: "What kinds of paper you buy." },
  { key: "ticketRange", label: "Typical ticket size", placeholder: "$50k–$500k", hint: "Range you'd bid per portfolio." },
  { key: "phone", label: "Phone", placeholder: "(555) 555-0123" },
  { key: "email", label: "Email", placeholder: "jane@firm.com" },
];

export function ProfileEditor() {
  const [profile, saveProfile] = useBuyerProfile();
  const [copiedSheet, setCopiedSheet] = useState(false);

  const complete = isProfileComplete(profile);
  const filledCount = Object.values(profile).filter((v) => v.trim()).length;
  const totalCount = FIELDS.length;

  const copySheet = async () => {
    try {
      await navigator.clipboard.writeText(buildBuyerProfileSheet(profile));
      setCopiedSheet(true);
      setTimeout(() => setCopiedSheet(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-8">
      <div
        className={`rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap ${
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
          <span className="text-[14px] text-[color:var(--color-fg)]">
            {complete ? (
              <>
                Profile complete · auto-filling everywhere ·{" "}
                <span className="text-[color:var(--color-fg-dim)]">
                  {filledCount}/{totalCount} fields
                </span>
              </>
            ) : (
              <>
                Profile incomplete ·{" "}
                <span className="text-[color:var(--color-fg-dim)]">
                  {filledCount}/{totalCount} fields filled
                </span>
              </>
            )}
          </span>
        </div>
        {complete && (
          <Link
            href="/app/banks"
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-bg)] transition"
          >
            See it in action →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.full ? "md:col-span-2" : ""}>
            <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              {f.label}
            </label>
            <input
              type="text"
              value={profile[f.key]}
              onChange={(e) => saveProfile({ ...profile, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="mt-1.5 w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
            />
            {f.hint && (
              <p className="mt-1.5 text-[11px] text-[color:var(--color-fg-faint)] leading-snug">
                {f.hint}
              </p>
            )}
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Your buyer-profile sheet (auto-generated)
          </div>
          <button
            type="button"
            onClick={copySheet}
            disabled={!complete}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 disabled:opacity-40 transition"
          >
            {copiedSheet ? "Copied ✓" : "Copy sheet"}
          </button>
        </div>
        <p className="text-[12px] text-[color:var(--color-fg-dim)] mb-3">
          This is what you paste into emails when a broker asks for your buyer
          profile. It updates automatically as you edit fields above.
        </p>
        <pre className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded p-4">
          {buildBuyerProfileSheet(profile)}
        </pre>
      </section>

      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          Where this profile is used
        </div>
        <ul className="space-y-2 text-[13px] text-[color:var(--color-fg-dim)]">
          <li className="flex items-center gap-2">
            <span className="text-[color:var(--color-accent)]">→</span>
            <Link href="/app/banks" className="hover:text-[color:var(--color-accent)] transition">
              Bank detail pages
            </Link>{" "}
            — every outreach email + 7 reply templates
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[color:var(--color-accent)]">→</span>
            <Link href="/app/playbook" className="hover:text-[color:var(--color-accent)] transition">
              Playbook
            </Link>{" "}
            — first-call scripts, 5 email scenarios, objection responses
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[color:var(--color-accent)]">→</span>
            <Link href="/app/tutor" className="hover:text-[color:var(--color-accent)] transition">
              AI tutor
            </Link>{" "}
            — Claude knows your firm and answers using your actual situation
          </li>
        </ul>
      </section>
    </div>
  );
}
