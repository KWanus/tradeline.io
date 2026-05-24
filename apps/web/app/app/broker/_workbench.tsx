"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";
import {
  type Buyer,
  addBuyer,
  addBuyers,
  readBuyers,
  recordDealClosedWith,
  removeBuyer,
  seedStarterBuyers,
} from "@/lib/buyer-book";
import {
  TEMPLATE_CSV,
  parseBuyerCsv,
  toBuyerInput,
} from "@/lib/buyer-book-csv";
import {
  type InboundPortfolio,
  addPortfolio,
  readPortfolios,
  removePortfolio,
  setPortfolioSold,
  setPortfolioStatus,
} from "@/lib/inbound-portfolios";
import { MatchQueue } from "./_match-queue";

function formatUSD(n: number): string {
  if (!n) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${abs.toFixed(0)}`;
}

function csvToArr(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function BrokerWorkbench() {
  const [profile, setProfile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [portfolios, setPortfolios] = useState<InboundPortfolio[]>([]);

  useEffect(() => {
    setBuyers(readBuyers());
    setPortfolios(readPortfolios());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const isBroker = profile.role === "broker";

  const onActivate = () => {
    setProfile({ ...profile, role: "broker" });
    // First activation: seed the buyer book so the match queue isn't empty
    // on day 1. Seed is a no-op if the book already has entries.
    setBuyers(seedStarterBuyers());
  };

  const onDeactivate = () => {
    setProfile({ ...profile, role: "buyer" });
  };

  return (
    <div className="space-y-10">
      {!isBroker && (
        <ActivationCard onActivate={onActivate} />
      )}

      {isBroker && (
        <>
          <BrokerNavStrip />
          <MatchQueue
            portfolios={portfolios.filter((p) => p.status === "new" || p.status === "matched")}
            buyers={buyers}
            onPortfolioStatus={(id, status) => setPortfolios(setPortfolioStatus(id, status))}
            onPortfolioSold={(id, commission, buyerId) => {
              setPortfolios(setPortfolioSold(id, commission, buyerId));
              if (buyerId) {
                setBuyers(recordDealClosedWith(buyerId, commission));
              }
            }}
            onPortfolioRemove={(id) => setPortfolios(removePortfolio(id))}
          />

          <AddPortfolioForm
            onAdded={(input) =>
              setPortfolios(addPortfolio(input))
            }
            defaultState={profile.state}
          />

          <BuyerBookSection
            buyers={buyers}
            onAdded={(input) => setBuyers(addBuyer(input))}
            onBulkAdded={(inputs) => setBuyers(addBuyers(inputs))}
            onRemove={(id) => setBuyers(removeBuyer(id))}
          />

          <div className="pt-6 border-t border-[color:var(--color-line)]">
            <button
              type="button"
              onClick={onDeactivate}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
            >
              Switch back to buyer mode
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ActivationCard({ onActivate }: { onActivate: () => void }) {
  return (
    <section className="card-hero p-7 md:p-10">
      <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        Broker mode · off
      </div>
      <h2 className="mt-3 font-serif text-3xl md:text-5xl tracking-tight leading-tight text-[color:var(--color-fg)]">
        Match portfolios to buyers in your book — <span className="italic text-gradient-accent">one tap per intro.</span>
      </h2>
      <p className="mt-5 text-[14px] md:text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-3xl">
        Today, brokers live in email threads and spreadsheets. Tradeline replaces both: log every inbound portfolio, build your buyer book once, and the match queue surfaces who to introduce to whom — ranked by state license, asset class, and ticket size. Your spread, your relationships, your day.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
        <Tile head="1. Build your book" body="Add the debt buyers you know — what they buy, where they're licensed, ticket range. One-time setup." />
        <Tile head="2. Log inbound tapes" body="Every portfolio a seller offers you becomes a card in the match queue." />
        <Tile head="3. Send intros" body="Three ranked buyer matches per tape. Approve → email goes out with your signature, your reply-to." />
      </div>
      <button
        type="button"
        onClick={onActivate}
        className="btn-primary mt-8"
      >
        Activate broker mode →
      </button>
      <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)]">
        You can switch back to buyer mode anytime. Your buyer book and portfolios stay saved either way.
      </p>
    </section>
  );
}

function BrokerNavStrip() {
  return (
    <nav className="flex items-center gap-2 flex-wrap">
      <Link
        href={"/app/broker/ledger" as never}
        className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-success-dim)] text-[color:var(--color-success)] hover:bg-[color:var(--color-success-soft)] transition"
      >
        $ Ledger
      </Link>
      <Link
        href={"/app/today" as never}
        className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
      >
        ☀ Today
      </Link>
    </nav>
  );
}

function Tile({ head, body }: { head: string; body: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
        {head}
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">{body}</p>
    </div>
  );
}

function AddPortfolioForm({
  onAdded,
  defaultState,
}: {
  onAdded: (input: {
    sellerName: string;
    sellerState: string;
    assetClass: string;
    faceValueUsd: number;
    notes: string;
  }) => void;
  defaultState?: string;
}) {
  const [sellerName, setSellerName] = useState("");
  const [sellerState, setSellerState] = useState(defaultState || "");
  const [assetClass, setAssetClass] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerName.trim()) return;
    onAdded({
      sellerName: sellerName.trim(),
      sellerState: sellerState.trim().toUpperCase(),
      assetClass: assetClass.trim(),
      faceValueUsd: Number(faceValue) || 0,
      notes: notes.trim(),
    });
    setSellerName("");
    setAssetClass("");
    setFaceValue("");
    setNotes("");
  };

  if (!open) {
    return (
      <section>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] tracking-[0.18em] uppercase px-4 py-2.5 rounded-full border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
        >
          + Log inbound portfolio
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-[16px] font-semibold tracking-tight text-[color:var(--color-fg)]">
          Log inbound portfolio
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
        >
          Close
        </button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormInput label="Seller name *" value={sellerName} onChange={setSellerName} placeholder="First Citizens Bank" />
        <FormInput label="State (2-letter)" value={sellerState} onChange={(v) => setSellerState(v.toUpperCase())} placeholder="NC" maxLength={2} />
        <FormInput label="Asset class" value={assetClass} onChange={setAssetClass} placeholder="consumer credit card" />
        <FormInput label="Face value USD" value={faceValue} onChange={setFaceValue} placeholder="4200000" type="number" />
        <div className="md:col-span-2">
          <FormTextarea label="Notes" value={notes} onChange={setNotes} placeholder="Talked to Sarah at the seller — they want offers by Friday." />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-primary text-[13px]">
            Save portfolio
          </button>
          <span className="text-[11px] text-[color:var(--color-fg-faint)]">
            Adds to the match queue immediately.
          </span>
        </div>
      </form>
    </section>
  );
}

function BuyerBookSection({
  buyers,
  onAdded,
  onBulkAdded,
  onRemove,
}: {
  buyers: Buyer[];
  onAdded: (input: Omit<Buyer, "id" | "addedAt">) => void;
  onBulkAdded: (inputs: Array<Omit<Buyer, "id" | "addedAt">>) => void;
  onRemove: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(buyers.length === 0);
  const [showImport, setShowImport] = useState(false);

  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Buyer book
          </div>
          <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
            {buyers.length} {buyers.length === 1 ? "buyer" : "buyers"} in your network
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowImport((v) => !v);
              if (!showImport) setShowForm(false);
            }}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            {showImport ? "Close import" : "↑ Import CSV"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) setShowImport(false);
            }}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
          >
            {showForm ? "Close form" : "+ Add buyer"}
          </button>
        </div>
      </header>

      {showImport && (
        <CsvImportPanel
          onCommit={(inputs) => {
            onBulkAdded(inputs);
            setShowImport(false);
          }}
        />
      )}

      {showForm && (
        <AddBuyerForm
          onAdded={(input) => {
            onAdded(input);
            if (buyers.length > 0) setShowForm(false);
          }}
        />
      )}

      {buyers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)] text-center">
          Empty book. Add the buyers you already know — the match queue lights up the moment you log a portfolio.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[color:var(--color-line)] overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--color-bg-soft)]">
              <tr className="text-left font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)]">
                <th className="px-4 py-2.5">Buyer</th>
                <th className="px-4 py-2.5">States</th>
                <th className="px-4 py-2.5">Buys</th>
                <th className="px-4 py-2.5">Ticket</th>
                <th className="px-4 py-2.5 text-right">Activity</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              {buyers.map((b) => (
                <BuyerRow key={b.id} buyer={b} onRemove={onRemove} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AddBuyerForm({
  onAdded,
}: {
  onAdded: (input: Omit<Buyer, "id" | "addedAt">) => void;
}) {
  const [firm, setFirm] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [statesCsv, setStatesCsv] = useState("");
  const [assetCsv, setAssetCsv] = useState("");
  const [ticketMin, setTicketMin] = useState("");
  const [ticketMax, setTicketMax] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firm.trim()) return;
    onAdded({
      firm: firm.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      licensedStates: csvToArr(statesCsv).map((s) => s.toUpperCase()),
      assetClasses: csvToArr(assetCsv),
      ticketMinUsd: Number(ticketMin) || 0,
      ticketMaxUsd: Number(ticketMax) || 0,
      lastDealAt: undefined,
      notes: notes.trim(),
    });
    setFirm("");
    setContactName("");
    setEmail("");
    setStatesCsv("");
    setAssetCsv("");
    setTicketMin("");
    setTicketMax("");
    setNotes("");
  };

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <FormInput label="Firm *" value={firm} onChange={setFirm} placeholder="Cavalry Investments" />
      <FormInput label="Contact name" value={contactName} onChange={setContactName} placeholder="Sarah Lee" />
      <FormInput label="Email" value={email} onChange={setEmail} placeholder="sarah@cavalry.com" type="email" />
      <FormInput label="Licensed states (comma-sep)" value={statesCsv} onChange={setStatesCsv} placeholder="NC, VA, SC" />
      <FormInput label="Asset classes (comma-sep)" value={assetCsv} onChange={setAssetCsv} placeholder="consumer credit card, auto" />
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Ticket min USD" value={ticketMin} onChange={setTicketMin} placeholder="100000" type="number" />
        <FormInput label="Ticket max USD" value={ticketMax} onChange={setTicketMax} placeholder="5000000" type="number" />
      </div>
      <div className="md:col-span-2">
        <FormTextarea label="Notes" value={notes} onChange={setNotes} placeholder="Met at NCBA conf. Closes fast. Prefers email." />
      </div>
      <div className="md:col-span-2 flex items-center gap-3">
        <button type="submit" className="btn-primary text-[13px]">
          Add to book
        </button>
        <span className="text-[11px] text-[color:var(--color-fg-faint)]">
          Saved locally to your browser. The matcher uses every field above to rank fit.
        </span>
      </div>
    </form>
  );
}

function BuyerRow({
  buyer: b,
  onRemove,
}: {
  buyer: Buyer;
  onRemove: (id: string) => void;
}) {
  const sent = b.introsSent || 0;
  const closed = b.dealsClosedCount || 0;
  const revenue = b.lifetimeCommissionUsd || 0;
  // Active = at least one intro sent; loyal = ≥1 closed deal. Drives the
  // dot color so the broker can scan the book for who's actually paying.
  const tone =
    closed > 0
      ? "bg-[color:var(--color-success)]"
      : sent > 0
        ? "bg-[color:var(--color-accent)]"
        : "bg-[color:var(--color-fg-faint)]";

  return (
    <tr className="text-[color:var(--color-fg)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone}`}
            title={
              closed > 0
                ? "Loyal buyer — closed deals with you"
                : sent > 0
                  ? "Active — intros sent, no closes yet"
                  : "Cold — no intros sent yet"
            }
          />
          <div className="min-w-0">
            <div className="font-medium truncate">{b.firm}</div>
            {b.contactName && (
              <div className="text-[11px] text-[color:var(--color-fg-dim)] truncate">
                {b.contactName}
              </div>
            )}
            {b.email && (
              <div className="text-[10px] text-[color:var(--color-fg-faint)] truncate">
                {b.email}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-fg-dim)] font-mono text-[11px]">
        {b.licensedStates.join(", ") || "—"}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-fg-dim)] text-[12px]">
        {b.assetClasses.join(", ") || "—"}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-fg-dim)] font-mono text-[11px]">
        {b.ticketMinUsd || b.ticketMaxUsd
          ? `${formatUSD(b.ticketMinUsd)} – ${formatUSD(b.ticketMaxUsd)}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[11px] leading-tight whitespace-nowrap">
        <div className="text-[color:var(--color-fg-dim)]">
          {sent} sent · {closed} closed
        </div>
        {revenue > 0 && (
          <div className="text-[color:var(--color-success)] font-semibold">
            {formatUSD(revenue)} earned
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${b.firm} from your book?`)) onRemove(b.id);
          }}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-danger)] transition"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

function CsvImportPanel({
  onCommit,
}: {
  onCommit: (inputs: Array<Omit<Buyer, "id" | "addedAt">>) => void;
}) {
  const [text, setText] = useState("");

  const parsed = text.trim() ? parseBuyerCsv(text) : null;
  const validRows = parsed?.rows ?? [];

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tradeline-buyer-book-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setText(await file.text());
  };

  return (
    <div className="mt-4 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-[color:var(--color-fg)]">
            Import buyer book from CSV
          </h3>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug max-w-2xl">
            Paste a CSV/TSV (Google Sheets &ldquo;copy as table&rdquo; works) or pick a file. Multi-value columns like states or asset classes can use{" "}
            <code className="font-mono text-[11px]">;</code> or{" "}
            <code className="font-mono text-[11px]">|</code> inside.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          ↓ Download template
        </button>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition">
            ↑ Pick file
          </span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="hidden"
          />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"firm,contact name,email,licensed states,asset classes,ticket min usd,ticket max usd,notes\nCavalry,Sarah Lee,sarah@cavalry.com,NC;VA;SC,credit card,250000,5000000,Met at NCBA conf"}
        rows={8}
        className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] font-mono text-[12px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition resize-y"
      />

      {parsed && (
        <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4 space-y-3">
          <div className="text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            <span className="font-mono text-[11px] text-[color:var(--color-fg)] font-semibold">
              {validRows.length}
            </span>{" "}
            valid {validRows.length === 1 ? "row" : "rows"} parsed
            {parsed.totalRows > validRows.length && (
              <>
                {" · "}
                <span className="text-[color:var(--color-warn)]">
                  {parsed.totalRows - validRows.length} dropped (no firm)
                </span>
              </>
            )}
            {parsed.unmappedHeaders.length > 0 && (
              <>
                {" · "}
                <span className="text-[color:var(--color-warn)]">
                  ignored: {parsed.unmappedHeaders.join(", ")}
                </span>
              </>
            )}
          </div>

          {validRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[color:var(--color-line)]">
              <table className="w-full text-[12px]">
                <thead className="bg-[color:var(--color-bg-1)]">
                  <tr className="text-left font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)]">
                    <th className="px-3 py-2">Firm</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">States</th>
                    <th className="px-3 py-2">Buys</th>
                    <th className="px-3 py-2">Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-line)]">
                  {validRows.slice(0, 5).map((r, idx) => (
                    <tr key={idx} className="text-[color:var(--color-fg)]">
                      <td className="px-3 py-2 font-medium">{r.firm}</td>
                      <td className="px-3 py-2 text-[color:var(--color-fg-dim)]">
                        {r.contactName || "—"}
                        {r.email && (
                          <div className="text-[10px] text-[color:var(--color-fg-faint)]">{r.email}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--color-fg-dim)] font-mono text-[10px]">
                        {r.licensedStates.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--color-fg-dim)]">
                        {r.assetClasses.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--color-fg-dim)] font-mono text-[10px]">
                        {r.ticketMinUsd || r.ticketMaxUsd
                          ? `${formatUSD(r.ticketMinUsd)} – ${formatUSD(r.ticketMaxUsd)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validRows.length > 5 && (
                <div className="bg-[color:var(--color-bg-1)] px-3 py-2 text-[11px] text-[color:var(--color-fg-faint)] text-center">
                  + {validRows.length - 5} more
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={() => onCommit(validRows.map(toBuyerInput))}
              className="btn-primary text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {validRows.length} {validRows.length === 1 ? "buyer" : "buyers"} to book
            </button>
            <button
              type="button"
              onClick={() => setText("")}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number";
  maxLength?: number;
}) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition resize-y"
      />
    </label>
  );
}
