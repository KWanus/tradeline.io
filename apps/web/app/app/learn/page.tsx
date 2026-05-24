import Link from "next/link";
import { JourneyLadder } from "./_journey-ladder";

export const dynamic = "force-dynamic";

export default function LearnPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <header className="mb-14">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Start here
        </div>
        <h1 className="mt-4 font-serif text-5xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          How this <span className="italic text-[color:var(--color-accent)]">whole business</span>{" "}
          actually works.
        </h1>
        <p className="mt-6 text-[color:var(--color-fg-dim)] text-xl leading-relaxed max-w-2xl">
          Plain English. No jargon without a definition. If you&rsquo;re new to
          debt buying, read top to bottom — by the end you&rsquo;ll understand
          what every page in Tradeline is for and why it exists.
        </p>
      </header>

      <Section label="The basic story" tag="01">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)]">
          When somebody stops paying their credit card or car loan, the bank
          tries to collect for a few months. After about 6 months of not getting
          paid, the bank gives up — they &ldquo;charge it off,&rdquo; meaning they
          accept the loss on their books and stop counting it as money owed.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-fg)]">
          But the debt still exists. The borrower still owes the money. The bank
          just doesn&rsquo;t want to keep chasing them. So the bank packages
          thousands of these charged-off accounts together (this package is
          called a &ldquo;tape&rdquo;) and <strong>sells the tape</strong> to
          someone else — usually for pennies on the dollar.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-fg)]">
          The someone-else who buys the tape is a <strong>debt buyer</strong>.
          That&rsquo;s the business. Buy the tape cheap, try to collect more than
          you paid, keep the difference.
        </p>
        <ConcreteExample
          left="A bank sells you a tape with $1,000,000 in unpaid balances for $50,000."
          right="If you collect $150,000 over the next 5 years, you made $100,000."
        />
      </Section>

      <Section label="Who are all the players?" tag="02">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)] mb-4">
          The market has six different roles. Tradeline gives you a tool for
          each one. Here&rsquo;s who they are and where they fit in.
        </p>
        <PlayerCard
          name="Originator (the bank)"
          link={null}
          summary="The lender that originally made the loan. Banks like JPMorgan, Capital One, Wells Fargo. They charge off bad loans and sell them to clean up their books."
          tradelinePage="/app/banks"
          tradelineNote="Tradeline tracks 31 of them, watches their public filings for signs they're about to sell paper."
        />
        <PlayerCard
          name="Broker (the middleman)"
          link="/app/brokers"
          summary="When a bank decides to sell, they don't post a 'For Sale' sign on Twitter. They use a broker — a middleman company — to find buyers and run the auction. Like the eBay of debt portfolios."
          tradelinePage="/app/brokers"
          tradelineNote="Tradeline lists the 9 major US brokers — NLEX, Garnet, RMG, Kondaur, etc. — with what they specialize in and how to reach them."
        />
        <PlayerCard
          name="Buyer (you, eventually)"
          link={null}
          summary="The licensed company that takes ownership of the debt. Pays the bank or broker. Tries to collect. To do this legally you need a state debt-buyer license — that's why we keep saying 'licensed buyer.'"
          tradelinePage="/app/compliance"
          tradelineNote="Tradeline tracks your licenses and warns you when bonds are about to expire."
        />
        <PlayerCard
          name="Servicer (the collector)"
          link="/app/servicers"
          summary="A third-party company that does the actual collecting on your behalf. They contact borrowers, negotiate payment plans, mail validation notices. They take a cut (usually 25–45% of what they collect)."
          tradelinePage="/app/servicers"
          tradelineNote="Tradeline (eventually) tracks how each servicer performs against the others — useful when you have a panel of 3-5 servicers."
        />
        <PlayerCard
          name="Lender (the leverage provider)"
          link="/app/lenders"
          summary="Once your debt portfolio is paying reliably for 12+ months (it's now 'performing'), banks and credit funds will lend you money against it — like a mortgage on a house, but the house is your debt portfolio. You use the borrowed money to buy more debt."
          tradelinePage="/app/lenders"
          tradelineNote="Tradeline lists the major US hypothecation lenders — what asset types they take, what advance rate they offer."
        />
        <PlayerCard
          name="Regulators"
          link={null}
          summary="The CFPB (federal) and state attorneys general make sure debt buyers and servicers follow consumer-protection laws (FCRA, FDCPA, Reg F). They issue licenses, audit collection practices, and sue people who break the rules."
          tradelinePage="/app/compliance"
          tradelineNote="Tradeline keeps a state-by-state SOL chart and Reg F change feed so you don't get blindsided."
        />
      </Section>

      <Section label="The lifecycle of one tape" tag="03">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)] mb-4">
          From the moment a borrower stops paying to the moment you cash out.
          This is the loop you operate in.
        </p>
        <ol className="space-y-3 list-decimal pl-6 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <li>
            <strong className="text-[color:var(--color-fg)]">A borrower stops paying.</strong>{" "}
            Could be credit card, auto loan, medical bill — any debt.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">~6 months later, the bank charges it off.</strong>{" "}
            They write the debt down to zero on their books, but they still own
            the right to collect.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">The bank groups thousands of charge-offs into a &ldquo;tape.&rdquo;</strong>{" "}
            A tape is a CSV/Excel file with one row per debtor and basic info:
            balance, last payment date, state, etc.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">The bank sells the tape via a broker.</strong>{" "}
            Brokers run an auction or a private bid process. Buyers register,
            inspect a sample, and submit bids.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">You win the bid, wire the money.</strong>{" "}
            Now you own the tape. You also own the legal right to collect from
            every account on it (in states where you&rsquo;re licensed).
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">The tape goes to your servicer.</strong>{" "}
            They contact each debtor, send legally required &ldquo;validation
            notices,&rdquo; negotiate payment plans, sometimes file lawsuits.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Money trickles in over years.</strong>{" "}
            Some debtors pay in full, some make small monthly payments, many
            never pay anything. The realistic recovery rate on a fresh
            credit-card tape is 8–15% of the original face value, over 5–7 years.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">After 12+ months, the paying accounts become &ldquo;re-performing.&rdquo;</strong>{" "}
            That&rsquo;s when a lender will lend you money against them
            (hypothecation). You take the borrowed money and buy more tapes.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Repeat.</strong> This is the compounding loop. Each cycle expands your portfolio.
          </li>
        </ol>
      </Section>

      <Section label="Where you fit in" tag="04">
        <JourneyLadder />
      </Section>

      <Section label="Glossary — the words people will use" tag="05">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)] mb-5">
          A broker on the phone will fire these at you assuming you know them.
          Here&rsquo;s plain-English versions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Term word="Tape" defn="The CSV file of debtor accounts being sold. 'I'm reviewing a tape from Garnet' means 'I'm looking at a list of accounts a broker named Garnet wants to sell me.'" />
          <Term word="Face value (par)" defn="The total dollars unpaid across all accounts in the tape. If 1,000 accounts each owe $5,000, the face value is $5M." />
          <Term word="Cents on the dollar (¢/$)" defn="Price as a percent of face value. 5¢ on $1M face = $50,000 to buy." />
          <Term word="Vintage" defn="How old the charge-offs are. 'Fresh' = under a year. 'Aged' = 1-3 years. 'Junk' = 5+ years and probably worthless." />
          <Term word="Charge-off" defn="When the bank gave up and wrote the debt off. The trigger that puts a debt on the secondary market." />
          <Term word="NPL (non-performing loan)" defn="A loan where the borrower has stopped paying. After charge-off, NPLs become the asset class debt buyers trade." />
          <Term word="Re-performing note (RPN)" defn="A previously-defaulted loan where the borrower has resumed paying (usually on modified terms). Worth more than a non-performing one because it actually generates cash." />
          <Term word="Hypothecation" defn="Borrowing against your re-performing portfolio. Like a mortgage where the collateral is your debt-buying portfolio instead of a house." />
          <Term word="Servicer" defn="Third-party company that does the actual collecting. Sends notices, takes phone calls, processes payments. Charges 25–45% of what they collect." />
          <Term word="Servicing fee" defn="What the servicer takes — 25–45% of dollars collected, depending on the contract." />
          <Term word="SOL (statute of limitations)" defn="How many years after default the debt is legally collectable. Varies by state, 3-10 years typical. After SOL passes, you can still try to collect but you can't sue." />
          <Term word="Validation notice" defn="A letter the servicer must send (per Reg F) telling debtors who they are, who owns the debt now, and how to dispute. Failing to send these is a fast path to a class action." />
          <Term word="Buyback (putback)" defn="A clause where the seller takes accounts back — bankruptcies, deceased, identity theft. Standard in any decent contract." />
          <Term word="Skip" defn="An account where the debtor is unreachable (moved, changed phone, etc.). The 'skip rate' on a tape tells you how many will probably never pay." />
          <Term word="Forward flow" defn="An ongoing agreement to buy a seller's monthly charge-offs at a fixed price for a set period. The opposite of 'spot deals,' which are one-time." />
          <Term word="Panel buyer" defn="A buyer pre-approved to bid on a specific bank's tapes. Major banks (JPM, BofA, Citi) only sell to their panel — getting on it takes years and serious capital." />
          <Term word="FCRA" defn="Fair Credit Reporting Act. Federal law that regulates how consumer credit data can be used. Triggers: reselling consumer profiles, scoring people for third parties. Easy to break, hard to recover from." />
          <Term word="FDCPA / Reg F" defn="Fair Debt Collection Practices Act + the CFPB's 2021 rule (Reg F). Caps contact frequency at 7 calls/week, requires specific disclosures, regulates email/text. Breaking these is how class actions start." />
          <Term word="GLBA" defn="Gramm-Leach-Bliley Act. Privacy law about how financial info on identifiable consumers can be shared. Requires privacy notices, restricts re-sale." />
          <Term word="MCM (Midland, Encore)" defn="Encore Capital, parent of Midland Credit Management. The largest publicly-traded debt buyer in the US. You'll hear them named as the gold-standard competitor." />
        </div>
      </Section>

      <Section label="Common beginner mistakes" tag="06">
        <Mistake
          claim='&ldquo;I can buy debt for 0.3¢ on the dollar and 50% will pay it back.&rdquo;'
          reality="Half-true. Some old, dirty paper sells at 0.3¢, but it sells at 0.3¢because almost nobody on it can actually pay. Realistic recovery on fresh credit-card paper is 8–15% over 5-7 years; you should pay 4–7¢/$ for it. The 50% number is what someone selling you a course said."
        />
        <Mistake
          claim="&ldquo;I&rsquo;ll just hypothecate after 6 months — sites say 75% LTV is normal.&rdquo;"
          reality="Six months gets you 'lightly seasoned' status — most lenders want 12+. 75% LTV is real but only on secured paper (junior mortgages with property as collateral). On unsecured re-performing notes, expect 30-60%."
        />
        <Mistake
          claim="&ldquo;I can start buying as soon as I have the money.&rdquo;"
          reality="In ~30 states, buying or attempting to buy consumer debt without a state license is illegal. Brokers won't sell to you. You need to be licensed FIRST. That's typically 2-6 months and $5k-$50k."
        />
        <Mistake
          claim="&ldquo;I&rsquo;ll do my own collecting to save the servicer fee.&rdquo;"
          reality="Self-servicing is a separate licensing regime (FDCPA-heavy, state collection-agency licenses) and a different operational discipline. Most successful debt buyers route through third-party servicers — the 25-45% fee is worth it for the compliance and audit trail."
        />
        <Mistake
          claim="&ldquo;I can find debtors&rsquo; phone numbers and call them myself.&rdquo;"
          reality="Don't. That's regulated under FDCPA + state collection rules. Reg F caps contact frequency, requires specific disclosures. One mistake in how you contact one person can be a class-action template."
        />
        <Mistake
          claim="&ldquo;The big banks (JPM, Citi, BofA) sell directly if you ask.&rdquo;"
          reality="They only sell to panel buyers — buyers they've pre-vetted with multi-year track records, audited financials, $5M+ net worth. As a new operator, you start with mid-sized regional banks via brokers."
        />
      </Section>

      <Section label="What to read next" tag="07">
        <ul className="space-y-3 text-[15px] leading-relaxed">
          <li>
            <Link
              href="/app/today"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Today &rarr;
            </Link>{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              The radar — banks showing distress signals you should pay attention to.
            </span>
          </li>
          <li>
            <Link
              href="/app/playbook"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Closing playbook &rarr;
            </Link>{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              Scripts, emails, objection responses for talking to brokers.
            </span>
          </li>
          <li>
            <Link
              href="/app/tools/bid-calculator"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Bid calculator &rarr;
            </Link>{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              Run the numbers on a hypothetical purchase. See what 5¢/$ on $5M
              face actually means.
            </span>
          </li>
          <li>
            <Link
              href="/app/capital"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Capital allocation &rarr;
            </Link>{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              What to do with the money once it&rsquo;s flowing in.
            </span>
          </li>
          <li>
            <Link
              href="/app/roadmap"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Vision &amp; roadmap &rarr;
            </Link>{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              Where Tradeline is going and why.
            </span>
          </li>
        </ul>
      </Section>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Last updated 2026-05-06. This is general industry context, not legal or
        financial advice. Get a consumer-finance attorney before you do anything
        regulated.
      </p>
    </main>
  );
}

function Section({
  label,
  tag,
  children,
}: {
  label: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-baseline gap-4 mb-6">
        <span className="font-mono text-[12px] text-[color:var(--color-accent)] tracking-wider">
          {tag}
        </span>
        <span className="font-semibold text-[24px] text-[color:var(--color-fg)] tracking-tight">
          {label}
        </span>
      </div>
      {children}
    </section>
  );
}

function ConcreteExample({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-5 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-2">
        Concrete example
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[10px] text-[color:var(--color-warn)] tracking-wider">
            WHAT YOU PAY
          </div>
          <p className="mt-1 text-[14px] text-[color:var(--color-fg)]">{left}</p>
        </div>
        <div>
          <div className="font-mono text-[10px] text-[color:var(--color-accent)] tracking-wider">
            WHAT MIGHT COME BACK
          </div>
          <p className="mt-1 text-[14px] text-[color:var(--color-fg)]">{right}</p>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  name,
  link,
  summary,
  tradelinePage,
  tradelineNote,
}: {
  name: string;
  link: string | null;
  summary: string;
  tradelinePage: string;
  tradelineNote: string;
}) {
  return (
    <div className="mb-3 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="text-[16px] font-medium text-[color:var(--color-fg)]">
        {name}
      </div>
      <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {summary}
      </p>
      <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)] uppercase">
          In Tradeline
        </div>
        <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)]">
          {tradelineNote}{" "}
          {link && (
            <Link
              href={link}
              className="text-[color:var(--color-accent)] hover:underline ml-1"
            >
              Visit page &rarr;
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}

function Term({ word, defn }: { word: string; defn: string }) {
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[13px] text-[color:var(--color-accent)]">
        {word}
      </div>
      <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {defn}
      </p>
    </div>
  );
}

function Mistake({ claim, reality }: { claim: string; reality: string }) {
  return (
    <div className="mb-3 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-warn)] uppercase">
        What people say
      </div>
      <p
        className="mt-2 text-[14px] text-[color:var(--color-warn)] italic"
        dangerouslySetInnerHTML={{ __html: claim }}
      />
      <div className="mt-3 font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-accent)] uppercase">
        Reality
      </div>
      <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
        {reality}
      </p>
    </div>
  );
}
