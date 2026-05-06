import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  return (
    <PlaceholderPage
      scope="Phase 2 · For all licensed buyers"
      title="Compliance"
      lede="License + bond + regulatory tracker. State-by-state. Auto-monitored. Sticky, anxiety-reducing, recurring."
      becomes={[
        "Your licenses by state — issue date, expiration, renewal fee, bond amount, surety carrier",
        "Bond renewal alerts 90 / 60 / 30 days out",
        "Reg F / FDCPA changes, AG enforcement actions, CFPB orders matched to your operating footprint",
        "State-by-state SOL chart for the asset classes you hold",
        "Auto-generated compliance memos for new states you’re entering",
        "Audit-ready export package — proof your activity stayed within license scope",
      ]}
      whenItShips={
        <p>
          Phase 2. The compliance tracker MCP server is already roadmapped — see{" "}
          <code className="font-mono text-[12px] text-[color:var(--color-fg)]">02_ARCHITECTURE.md</code>{" "}
          § <code className="font-mono text-[12px] text-[color:var(--color-fg)]">compliance-tracker-mcp</code>.
          The dashboard view ships alongside.
        </p>
      }
      whyItMatters={
        <p>
          Most buyers spend $5k–$25k/year on outside compliance counsel for things software can do
          better. We surface the same anxiety-reducing data continuously, at a fraction of the cost.
          Once a customer wires their license + bond data into Tradeline, switching costs become
          real — they don’t want to rebuild that workspace anywhere else.
        </p>
      }
    />
  );
}
