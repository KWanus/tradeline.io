import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <PlaceholderPage
      scope="Year 2 · Post-license"
      title="My portfolio"
      lede="Once you’re a licensed buyer servicing your own debt, this is your operational dashboard. How much you own, who’s paying, recovery rate, contract status, hypothecation eligibility."
      becomes={[
        "Each portfolio you own — purchase price, face value, asset class, vintage, seller, broker",
        "Performing balance vs. original; aggregate collection rate (no consumer-level rows surfaced here)",
        "Servicer status, monthly remittances, fee schedule",
        "Hypothecation tracker — months of seasoning, advance-rate eligibility, lender relationships",
        "Contracts (purchase, servicing, hypothecation) stored as encrypted attachments",
        "Cash-flow ledger feeding monthly investor / personal P&L reports",
      ]}
      whenItShips={
        <p>
          Year 2, after you hold a state debt-buyer license, are bonded, and have purchased your
          first portfolio. Per <code className="font-mono text-[12px] text-[color:var(--color-fg)]">03_PHASE_ROADMAP.md</code>{" "}
          Phase 4–5.
        </p>
      }
      whyItMatters={
        <p>
          The portfolio dashboard closes the loop on the founder’s original vision: buy →
          re-perform → hypothecate. It also dogfoods our own product — every workflow that’s
          painful for us internally becomes a feature we can sell to other licensed buyers.
        </p>
      }
      compliance={
        <>
          <p>
            <span className="text-[color:var(--color-accent)]">Stores:</span> portfolio-level
            aggregates, contracts, servicer reports, your operational P&amp;L. This is your business’s
            books — entirely lawful for a licensed buyer to keep.
          </p>
          <p>
            <span className="text-[color:var(--color-warn)]">Never stores in this view:</span>{" "}
            individual debtor names, addresses, phones, or payment history surfaced as a ranked
            list. That data lives only in the encrypted tape file with your servicer (or in a
            separate, RLS-isolated, audited{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">customer_tapes</code>{" "}
            table — schema in <code className="font-mono text-[12px] text-[color:var(--color-fg)]">docs/schema.sql</code>),
            and is never aggregated across buyers or sold. That distinction is the line between an
            operating debt buyer (legal) and a Consumer Reporting Agency (separate registration).
          </p>
        </>
      }
    />
  );
}
