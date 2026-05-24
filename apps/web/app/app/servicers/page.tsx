import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { ServicerRow, type Servicer } from "./_servicer-row";

export const dynamic = "force-dynamic";

const SERVICERS: Servicer[] = [
  {
    name: "NCB Management Services",
    shortName: "NCB",
    url: "https://www.ncbmgt.com/",
    focus: ["credit card", "consumer", "auto"],
    size: "Large national",
    notes: "One of the most-used third-party servicers for new debt buyers. Strong compliance infrastructure.",
  },
  {
    name: "Resurgent Capital Services",
    shortName: "Resurgent",
    url: "https://www.resurgent.com/",
    focus: ["credit card", "consumer"],
    size: "Large national",
    notes: "Owned by Sherman Financial Group. Handles huge portfolio volumes; better fit once you have $5M+ face under management.",
  },
  {
    name: "JH Portfolio Debt Equities",
    shortName: "JH Portfolio",
    url: "https://www.jhpde.com/",
    focus: ["credit card", "telecommunications"],
    size: "Mid-size",
    notes: "Mid-sized servicer with good rates for first-time buyers. More flexible on smaller tickets.",
  },
  {
    name: "Plaza Servicing",
    shortName: "Plaza",
    url: "https://www.plazaservicing.com/",
    focus: ["mortgage", "junior mortgage", "real estate"],
    size: "Mortgage-specialist",
    notes: "Specializes in residential mortgage servicing. The default for buyers in junior-mortgage paper.",
  },
  {
    name: "Velocity Investments",
    shortName: "Velocity",
    url: "https://www.velocityinvestments.com/",
    focus: ["consumer", "specialty"],
    size: "Mid-size",
    notes: "Boutique-feel; willing to take smaller portfolios. Direct relationship with operators.",
  },
  {
    name: "Statebridge",
    shortName: "Statebridge",
    url: "https://www.statebridgecompany.com/",
    focus: ["mortgage", "real estate"],
    size: "Mortgage-specialist",
    notes: "Residential mortgage servicing, including first liens. Common partner for secured-paper buyers.",
  },
];

export default function ServicersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>⚙</span>}
        title="Servicers"
        badge={{ label: "Live", tone: "success" }}
        tagline="Collection partners ranked by recovery and compliance."
        meta={
          <Link
            href="/app/learn#servicers"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How servicing works →
          </Link>
        }
      />

      <section className="space-y-3">
        {SERVICERS.map((s) => (
          <ServicerRow key={s.shortName} servicer={s} />
        ))}
      </section>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            How to pick a servicer
          </div>
          <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            <li>Match the asset class — mortgage servicers don&rsquo;t collect credit cards well</li>
            <li>Get references from 3 prior buyers — actual recovery rates, not marketing</li>
            <li>Confirm their licensed states cover your tape&rsquo;s geographic mix</li>
            <li>Read their FDCPA / Reg F compliance manual — ask if they&rsquo;ll share</li>
            <li>Verify no open consent decree with CFPB or state AG</li>
          </ul>
        </div>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What good service looks like
          </div>
          <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            <li>Monthly remittance reports on a fixed cadence</li>
            <li>Reconciled to the dollar; variance flagged</li>
            <li>Validation notices proven sent within Reg F windows</li>
            <li>Buyback workflow when accounts hit standard exclusions (BK, deceased)</li>
            <li>Quarterly performance reviews against the original underwriting</li>
          </ul>
        </div>
      </section>

      <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Names + URLs are public; descriptions are starting
        approximations. Verify before approaching.
      </p>
    </main>
  );
}
