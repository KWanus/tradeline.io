import Link from "next/link";

export const dynamic = "force-dynamic";

const VOCAB: { term: string; def: string }[] = [
  { term: "Tape", def: "The CSV/Excel file of accounts being sold. Treat it as a noun: 'I'm reviewing a tape from Garnet.'" },
  { term: "Face value (or par)", def: "Total unpaid balance across all accounts. The headline number on a listing." },
  { term: "Cents on the dollar (¢/$)", def: "Price as a percent of face. 4¢ on $10M face = $400k purchase price." },
  { term: "Vintage", def: "How old the charge-offs are. Fresh = <12mo, aged = 1-3yr, junk = 5yr+." },
  { term: "Pool", def: "A specific group of accounts being sold together. 'The Q2 pool was clean.'" },
  { term: "Charge-off", def: "When a bank writes the loan off as uncollectible — the trigger that creates NPL." },
  { term: "Originator", def: "The lender that made the loan originally (the bank). Driver of paper quality." },
  { term: "Forward flow", def: "An ongoing agreement to buy a seller's monthly charge-offs at a fixed price." },
  { term: "Spot deal", def: "One-time purchase, opposite of forward flow." },
  { term: "Re-performing (RPN)", def: "A note (loan) where a previously-defaulted borrower is paying again on a modified schedule." },
  { term: "Hypothecation", def: "Borrowing against a performing/re-performing portfolio. Lender holds the paper as collateral." },
  { term: "Servicer", def: "Third-party that does the actual collecting. You buy the tape; they work it." },
  { term: "Servicing fee", def: "What the servicer takes — usually 25-45% of dollars collected." },
  { term: "SOL (statute of limitations)", def: "How long after default a debt is legally collectable. State-by-state, 3-10 years typically." },
  { term: "Validation", def: "Reg F requirement — initial communication telling debtors who you are and how to dispute." },
  { term: "Buyback / putback", def: "Seller takes an account back — bankruptcy, deceased, identity issue. Standard contract clause." },
  { term: "Skip", def: "An account where the debtor is unreachable. Reflected in 'skip rate' on a tape." },
];

const FIRST_CALL: { line: string; you: string; them?: string; coach?: string }[] = [
  { line: "Opening", you: "Hey [name], I'm [your name] with [your firm]. We're a licensed [state] buyer focused on [asset class]. I came across your shop through [RMAI / referral / website]. Have you got a minute?", coach: "Lead with location and license — both signal you're real. Asset class focus signals you're not tire-kicking everything." },
  { line: "Who you are", you: "We hold a [state] debt-buyer license, [state] bond at [amount], and run our recoveries through [servicer name]. Capital is [range — be honest]. We're not a panel buyer at the GSIBs yet but we close every deal we sign.", coach: "Brokers care about three things: license, capital, follow-through. Hit all three in two sentences." },
  { line: "Your appetite", you: "Specifically interested in [asset class] under [face value cap], [vintage] vintage, with [docs / region constraint]. Average ticket we're hitting right now is [X].", coach: "Specificity respects their time. Vague buyers waste broker calendars and never get the second call." },
  { line: "What you want from them", you: "If you've got tape that fits, even small — happy to take a first look. And I'd rather get on a regular cycle than chase you for postings.", coach: "The ask is access to their flow, not a specific deal. Long-tail relationship play, not a one-shot." },
  { line: "Sign-off", you: "I'll send a one-page intro with our license PDF, bond carrier, and bank reference. What's the best email?", coach: "Always end with a concrete next step you control. Don't say 'I'll wait to hear from you.'" },
];

const EMAILS: { scenario: string; subject: string; body: string }[] = [
  {
    scenario: "Cold introduction (first email after a call)",
    subject: "[Your firm] — licensed [state] buyer, [asset class] focus",
    body: `[Name], thanks for the call.

Recap of who we are:
- Licensed [state] debt buyer, [license #], [state] bond at [amount]
- [Asset class] focus, average ticket [X]
- Servicing through [servicer]; bank reference at [bank]

Attached: license PDF, surety bond letter, our buyer profile.

Send me anything that fits — even small tickets are fine for the first one. Looking forward to a relationship, not a single trade.

[Signature with phone, email, license #]`,
  },
  {
    scenario: "Tape inquiry (you saw a posting)",
    subject: "Q on [pool name / face value]",
    body: `[Name], I saw the [face value] [asset class] pool on [platform]. Couple questions before we engage:

1. Vintage range and document completeness?
2. Geographic mix?
3. Any prior sales / how many hands?
4. Buyback list — how does the seller handle bankruptcies and deceased?

If those check, we'll bid. Targeting [your range] depending on tape detail.

[Signature]`,
  },
  {
    scenario: "Bid submission",
    subject: "Bid — [pool name / face value]",
    body: `[Name],

Our bid: [price] on the full pool, payable [terms — typically wire on contract execution].

Conditions: standard buyback (BK / deceased / SCRA / disputes / FCRA exposure), 30-day inspection on [N] random accounts, contract terms per [your standard or market].

This bid holds through [date]. Happy to discuss.

[Signature]`,
  },
  {
    scenario: "Walk-away (with grace)",
    subject: "Pass on [pool name] — let's stay in touch",
    body: `[Name], we're going to pass on this one. The [reason — vintage, prior-sales count, asset mix] doesn't fit our model.

Not a comment on you — happy to keep getting your postings. We're particularly active in [your sweet spot] right now.

[Signature]`,
  },
  {
    scenario: "Post-close follow-up",
    subject: "Thanks — closing checklist",
    body: `[Name], wire is going out [date]. A few items on closure:

- Final tape file via [secure transfer method]
- Buyback procedure if any account hits the [contract conditions]
- Reference for our next deal — would you mind?

Looking forward to the next round.

[Signature]`,
  },
];

const OBJECTIONS: { objection: string; response: string }[] = [
  {
    objection: '"We only sell to panel buyers / our existing relationships."',
    response: "Totally understand. I'm not asking to compete with your top buyers — I'm asking to be on your list for tickets your panel passes on, or for fits where my [specific asset class / region] focus is sharper. Small first deal builds the file.",
  },
  {
    objection: '"What\'s your track record? How many tapes have you closed?"',
    response: "Honest answer if early: 'Two so far. Both [details — face value, asset class, performance]. I'm building a track record one clean close at a time. References from [servicer] and [bank] available.' Don't bluff — brokers check, and getting caught ends the relationship permanently.",
  },
  {
    objection: '"Your bid is too low."',
    response: "Walk them through your math. 'My recovery model is [X]% over [Y] years given [vintage / region], at [servicer fee], targeting [IRR]. That gives me a max bid of [actual max]. I'm bidding under that for margin. If you have data showing better recovery, I'll re-run.' This is the bid calculator output. Pricing discipline is a virtue brokers respect.",
  },
  {
    objection: '"Why should I deal with a small buyer?"',
    response: "Three reasons: (1) Smaller buyers close their bid — I don't waste your week chasing committees. (2) I work the tape after close — you don't get angry debtor calls coming back at you. (3) Your panel buyers will pass on small or specialty tickets; I'll take them.",
  },
  {
    objection: '"Can you wire by Thursday?"',
    response: "Honest answer if you can: 'Yes — funds are sitting at [bank], wire goes the day contracts execute.' If you can't: 'I need [N] business days for the wire. If that's a deal-breaker, let's talk price adjustment.' Don't promise speed you can't deliver.",
  },
];

const RED_FLAGS: { flag: string; why: string }[] = [
  { flag: "Tape has been sold 3+ times", why: "Each prior buyer skimmed the easy money. Recovery rate falls steeply with each sale. Price has to be substantially lower or the math doesn't work." },
  { flag: "Seller refuses standard buybacks", why: "Bankruptcies, deceased, military (SCRA), and out-of-statute should always be putback-eligible. A seller who won't agree is hiding something or is unsophisticated." },
  { flag: "Documentation 'available on request'", why: "Means it doesn't exist or is bad. Insist on full doc samples in inspection. No-doc paper is uncollectable in many states post-Reg F." },
  { flag: "Vintage older than your servicer's strike zone", why: "Servicers have asset-class and vintage-specific recovery curves. Buying outside your servicer's curve means worse than expected recovery. Match the paper to the tool." },
  { flag: "Geographic concentration in restrictive states", why: "Some states (NY, MA, MD, CA) have aggressive consumer-protection rules. Concentration there changes the math significantly. State-by-state SOL chart is mandatory." },
  { flag: "Pressure for fast close", why: "If the seller wants you to wire in 48 hours with no inspection, they want to offload risk. Walk." },
  { flag: "Originator with consent decree or active CFPB action", why: "Inherits regulatory exposure. The accounts may be class-action material. Avoid until cleared." },
];

const CREDIBILITY: string[] = [
  "Lead with the boring stuff: license number, state bond, surety carrier, bank reference. The mark of a real buyer. Most fakers can't produce these.",
  "Have your servicer pre-arranged. Naming your servicer (\"running through NCB Management\") instantly signals you're operational.",
  "Quote prior deals by face value and asset class, never by debtor names or specifics that would be confidential. Confidentiality discipline is itself a credibility signal.",
  "Show up at one industry conference (RMAI annual, ARM in NYC, Receivables Roundup). One in-person handshake closes more accounts than 100 emails.",
  "Run a clean LinkedIn presence — your firm, your role, an industry photo. Brokers will look you up before answering your second email.",
  "If you don't have a track record, sell the discipline: \"My first bid will be conservative because I want to close, not negotiate. After we close once, you'll know I follow through.\"",
];

const STAGES: { stage: string; desc: string; tradeline: string }[] = [
  { stage: "1 · Sourced", desc: "You see the deal — a posting, a broker email, a signal in the radar.", tradeline: "Add to Pipeline. Tag broker, asset class, face value." },
  { stage: "2 · Reviewing", desc: "Headline numbers fit. Worth more time. Get the tape.", tradeline: "Move stage to Reviewing. Drop ask price into Pipeline." },
  { stage: "3 · Underwriting", desc: "Real evaluation. Recovery model, comparable deals, originator context.", tradeline: "Use the bid calculator. Read the bank's filings (radar). Set your max bid." },
  { stage: "4 · Bidding", desc: "Submit your bid. Be ready for a counter.", tradeline: "Record the bid in Pipeline. If the broker counters and you accept, advance to Won." },
  { stage: "5 · Won / Lost / Walked", desc: "Deal closes (Won), broker takes a higher bid (Lost), or you walk.", tradeline: "Mark the stage. The Brokers page (Year 2) will use this history to score broker relationships." },
];

export default function PlaybookPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Closing playbook
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          How to talk, persuade, and close.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Vocabulary, scripts, email templates, objections, red flags, the five-stage close, and
          how to build credibility before you have a track record. Reference material your AI
          assistant can pull on demand.
        </p>
      </header>

      <Section label="Stay close to your assistant">
        <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
          <p className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            You already have an MCP server built (<code className="font-mono text-[12px] text-[color:var(--color-fg)]">mcp-servers/deal-radar</code>).
            Connect it to Claude Desktop and your assistant has every signal, filing, and news item in
            this workbase available mid-conversation:
          </p>
          <pre className="mt-3 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-3 font-mono text-[11px] text-[color:var(--color-fg-dim)] overflow-x-auto leading-relaxed">{`> claude --mcp tradeline.deal-radar
   "I'm on a call with Garnet about a WAL tape.
    Pull WAL's latest charge-off cohort and last
    3 news mentions; draft objection responses for
    'why should we deal with a small buyer'."`}</pre>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Wire it up via{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
            — instructions in <code className="font-mono text-[12px] text-[color:var(--color-fg)]">mcp-servers/deal-radar/README.md</code>.
            Your radar runs every 6 hours via the GitHub Actions cron; the MCP serves the latest snapshot to your assistant.
          </p>
        </div>
      </Section>

      <Section label="Industry vocabulary">
        <p className="text-[14px] text-[color:var(--color-fg-dim)] mb-3">
          Use these terms correctly the first time. Misusing &ldquo;tape&rdquo; or &ldquo;face value&rdquo; signals you&rsquo;re new.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VOCAB.map((v) => (
            <div key={v.term} className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
              <div className="font-mono text-[12px] text-[color:var(--color-accent)] tracking-wide">{v.term}</div>
              <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">{v.def}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="The first call to a broker">
        <p className="text-[14px] text-[color:var(--color-fg-dim)] mb-4">
          A working script. Don&rsquo;t read it verbatim — internalize the structure. Brokers call back people who sound like operators, not amateurs.
        </p>
        <div className="space-y-4">
          {FIRST_CALL.map((f, i) => (
            <div key={i} className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
              <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                {f.line}
              </div>
              <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed italic">
                &ldquo;{f.you}&rdquo;
              </p>
              {f.coach && (
                <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  <span className="text-[color:var(--color-warn)]">Why:</span> {f.coach}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section label="Email templates">
        <div className="space-y-4">
          {EMAILS.map((e, i) => (
            <details
              key={i}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] [&[open]>summary]:border-b group"
            >
              <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between font-mono text-[12px] tracking-[0.18em] text-[color:var(--color-fg)] uppercase border-b border-transparent hover:bg-[color:var(--color-bg-2)] transition">
                <span>{e.scenario}</span>
                <span className="text-[color:var(--color-fg-faint)] group-open:rotate-90 inline-block transition-transform">
                  &rarr;
                </span>
              </summary>
              <div className="p-5 border-[color:var(--color-line)]">
                <div className="font-mono text-[11px] text-[color:var(--color-fg-faint)] mb-2">
                  <span className="text-[color:var(--color-fg-dim)]">Subject:</span> {e.subject}
                </div>
                <pre className="bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-4 font-mono text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed whitespace-pre-wrap">
{e.body}
                </pre>
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section label="Common objections — how to respond">
        <div className="space-y-3">
          {OBJECTIONS.map((o, i) => (
            <div key={i} className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
              <div className="text-[14px] text-[color:var(--color-warn)] italic">{o.objection}</div>
              <div className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">{o.response}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Walk-away red flags">
        <p className="text-[14px] text-[color:var(--color-fg-dim)] mb-3">
          Any one of these is a signal. Two together is a no.
        </p>
        <div className="space-y-3">
          {RED_FLAGS.map((r, i) => (
            <div key={i} className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
              <div className="text-[14px] font-medium text-[color:var(--color-danger)]">
                {r.flag}
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {r.why}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Building credibility without a track record">
        <ul className="space-y-3 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {CREDIBILITY.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section label="The five-stage close, mapped to Pipeline">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
          {STAGES.map((s, i) => (
            <div key={i} className="px-5 py-4">
              <div className="font-mono text-[12px] tracking-wide text-[color:var(--color-accent)]">{s.stage}</div>
              <div className="mt-1 text-[14px] text-[color:var(--color-fg)]">{s.desc}</div>
              <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)]">
                <span className="text-[color:var(--color-fg-faint)]">In Tradeline:</span> {s.tradeline}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link
            href="/app/pipeline"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            Open the pipeline &rarr;
          </Link>
        </div>
      </Section>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        This playbook is a starting point — your real edge accumulates over time as you record what
        works in Pipeline notes. The Phase-2 product surfaces those notes back to you when you&rsquo;re
        about to talk to the same broker about a similar tape.
      </p>
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-4">
        {label}
      </div>
      {children}
    </section>
  );
}
