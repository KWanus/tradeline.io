import Link from "next/link";
import { isUnsubscribed } from "@/lib/report-leads";
import { verifyUnsubToken } from "@/lib/unsubscribe";
import { UnsubscribeForm } from "./_form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;
  const email = (params.email || "").trim().toLowerCase();
  const token = params.token || "";

  const hasParams = Boolean(email && token);
  const tokenValid = hasParams && verifyUnsubToken(email, token);
  const already = tokenValid ? await isUnsubscribed(email) : false;

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)] flex items-center justify-center px-6 py-12">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </div>

        {!hasParams ? (
          <Card>
            <Eyebrow>Unsubscribe</Eyebrow>
            <h1 className="mt-3 font-serif text-3xl tracking-tight">
              Use the link in your email.
            </h1>
            <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              The unsubscribe link in any Tradeline weekly email will bring you
              back here with the right credentials. If you can&rsquo;t find a
              recent issue, just reply to one and ask us to remove you.
            </p>
            <p className="mt-4 text-[13px] text-[color:var(--color-fg-faint)]">
              Or contact <a className="text-[color:var(--color-accent)] hover:underline" href="mailto:hello@tradeline.io">hello@tradeline.io</a>.
            </p>
          </Card>
        ) : !tokenValid ? (
          <Card tone="danger">
            <Eyebrow tone="danger">Invalid or expired</Eyebrow>
            <h1 className="mt-3 font-serif text-3xl tracking-tight">
              That link doesn&rsquo;t verify.
            </h1>
            <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              The token in this URL didn&rsquo;t match for{" "}
              <span className="font-mono text-[13px] text-[color:var(--color-fg)]">{email}</span>.
              If you copied the link by hand it may be missing characters — try
              clicking from the email directly. Otherwise reply to any
              Tradeline email and we&rsquo;ll handle it manually.
            </p>
          </Card>
        ) : already ? (
          <Card tone="success">
            <Eyebrow tone="success">Already unsubscribed</Eyebrow>
            <h1 className="mt-3 font-serif text-3xl tracking-tight">
              You&rsquo;re off the list.
            </h1>
            <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              <span className="font-mono text-[13px] text-[color:var(--color-fg)]">{email}</span>{" "}
              was already unsubscribed. No further weekly emails will reach this
              address. If you change your mind, sign up again at{" "}
              <Link href="/report" className="text-[color:var(--color-accent)] hover:underline">
                /report
              </Link>
              .
            </p>
          </Card>
        ) : (
          <UnsubscribeForm email={email} token={token} />
        )}

        <p className="mt-8 text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] text-center">
          Tradeline · public-source data only · zero consumer information
        </p>
      </div>
    </main>
  );
}

function Card({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  const border =
    tone === "success"
      ? "border-[color:var(--color-success-dim)]"
      : tone === "danger"
        ? "border-[color:var(--color-danger)]"
        : "border-[color:var(--color-line)]";
  const bg =
    tone === "success"
      ? "bg-[color:var(--color-success-soft)]"
      : tone === "danger"
        ? "bg-[color:var(--color-danger-soft)]"
        : "bg-[color:var(--color-bg-1)]";
  return (
    <div className={`rounded-xl border ${border} ${bg} p-6 md:p-8`}>
      {children}
    </div>
  );
}

function Eyebrow({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "danger"
        ? "text-[color:var(--color-danger)]"
        : "text-[color:var(--color-fg-faint)]";
  return (
    <div
      className={`font-mono text-[10px] tracking-[0.25em] uppercase ${color}`}
    >
      {children}
    </div>
  );
}
