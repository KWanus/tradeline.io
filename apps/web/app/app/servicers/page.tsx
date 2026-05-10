import { PageIntro } from "../_components/page-intro";

export const dynamic = "force-dynamic";

type Servicer = {
  name: string;
  shortName: string;
  url: string;
  focus: string[];
  size: string;
  notes: string;
};

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
      <PageIntro
        eyebrow="Ecosystem"
        title={<>Who actually collects the debt for you.</>}
        lead={
          <>
            You buy the portfolio. They make the calls, send the letters, run the
            paperwork. Most debt buyers use 1–3 servicers instead of collecting
            themselves. The servicer takes 25–45% of every dollar they pull in —
            and that fee is worth it because they carry the legal risk.
          </>
        }
        doNow="Pick one servicer per asset class you bid on. Match the focus tags below to what you're buying."
        howThisWorks={
          <>
            <p>
              When you own debt, someone has to call debtors, send disclosure
              letters, take phone calls, negotiate payment plans, sometimes file
              lawsuits. That&rsquo;s the servicer&rsquo;s job.
            </p>
            <p>You don&rsquo;t do this yourself for two reasons:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Compliance risk.</strong> Federal law (FDCPA, Reg F) and
                state laws tightly regulate debt collection. One mistake can be a
                class-action lawsuit. Servicers have compliance departments.
              </li>
              <li>
                <strong>Different license.</strong> Most states require a separate
                collection-agency license to collect debt. Buyers stay on the
                buyer side; servicers stay on the collector side.
              </li>
            </ul>
            <p>
              They take 25–45% of every dollar they collect. If they pull in
              $100k, you get $55–75k. That&rsquo;s the cost of staying out of
              compliance trouble.
            </p>
          </>
        }
      />

      <section className="space-y-3">
        {SERVICERS.map((s) => (
          <article
            key={s.shortName}
            className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 hover:border-[color:var(--color-line-strong)] transition"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-medium text-[color:var(--color-fg)]">{s.name}</h2>
                <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                  {s.size}
                </div>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                Visit &rarr;
              </a>
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {s.focus.map((f) => (
                <span
                  key={f}
                  className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]"
                >
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {s.notes}
            </p>
          </article>
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
