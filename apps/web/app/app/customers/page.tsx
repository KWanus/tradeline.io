import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <PlaceholderPage
      scope="Phase 2 · Lights up at MRR > $0"
      title="Customers"
      lede="Your SaaS customers — licensed buyers, collection agencies, and debt brokers paying for Tradeline. Standard CRM, scoped tightly."
      becomes={[
        "Org name, primary contact, plan tier (Solo / Pro / Team / Enterprise), MRR",
        "License attestation per customer — every state they’re actually licensed in",
        "Last activity, design-partner status, founder-call schedule",
        "Per-customer usage analytics: radar visits, MCP tool calls, alerts subscribed",
        "Notes, support tickets, expansion conversations",
        "Affiliate referrals (10% recurring) tracked per partner",
      ]}
      whenItShips={
        <>
          <p>
            The day the first paying customer signs up. Building it before is spec-fiction; the
            actual shape will be set by what the first 5 customers ask for.
          </p>
          <p>
            See <code className="font-mono text-[12px] text-[color:var(--color-fg)]">03_PHASE_ROADMAP.md</code>{" "}
            § Weeks 11–12.
          </p>
        </>
      }
      whyItMatters={
        <p>
          To be the standard, we have to <em>retain</em> customers — every churn is a permanent
          loss of network-effect data. The CRM tracks the leading indicators (last login, MCP
          usage, alert subscriptions) so we catch unhealthy accounts in week 3, not month 3.
        </p>
      }
    />
  );
}
