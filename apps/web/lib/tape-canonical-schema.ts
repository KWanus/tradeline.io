// Canonical schema for debt portfolio tapes.
//
// Derived from the only public bank-to-debt-buyer purchase agreement that
// publishes a Computer-File field list verbatim (Spiegel Acceptance →
// Midland Funding, SEC EX-10.48, 2007), augmented with:
//   - CFPB Reg F §1006.34(c)(2) validation-notice minimum fields
//   - FTC 2013 Debt Buyer Study empirical field set
//   - OCC Bulletin 2014-37 minimum sale-data requirements
//   - CFPB Encore (2015/2020/2023) and PRA consent-order data references
//   - RMAI Standard #18 categories (member-gated; categories inferred from
//     the DFPI public comment letter)
//
// Field aliases are the 27 most-commonly-seen variants per field, mined
// from the sources above. The decoder maps any seller's headers onto this
// schema with confidence scores, then scores completeness and flags
// Reg F minimum gaps.
//
// PII fields are DEFINED here but the row-level analyzer never reads their
// values — it only detects presence/absence for Reg F minimum-field checks
// and completeness scoring. This preserves the privacy-first posture of
// the original tape-analyzer module.

export type FieldCategory =
  | "account_identity"
  | "consumer_identity"
  | "consumer_contact"
  | "balance_financial"
  | "dates"
  | "debt_characteristics"
  | "prior_collection"
  | "chain_of_custody"
  | "scrub_status"
  | "original_creditor";

export type FieldCriticality =
  // Required by 12 CFR 1006.34(c)(2). Absence = tape cannot legally
  // support a validation notice, so the entire tape is unusable in
  // production until the seller supplements.
  | "reg_f_minimum"
  // Required for collection legality, FCRA accuracy, or core underwriting.
  // Absence is a hard red flag.
  | "critical"
  // Materially affects valuation, SOL math, or workflow. Absence narrows
  // what the buyer can do but doesn't kill the deal.
  | "important"
  // Adds value when present; absence is fine.
  | "optional"
  // Useful for context but not for decisions.
  | "cosmetic";

export type CanonicalField = {
  name: string;
  label: string;
  category: FieldCategory;
  criticality: FieldCriticality;
  dataType: "string" | "number" | "date" | "bool" | "enum";
  // PII fields are detected by header but their row values are never read
  // by the in-browser analyzer.
  isPii: boolean;
  // Header patterns. Order matters only for tie-breaking; first match wins.
  aliases: RegExp[];
  description: string;
  // Source citation — kept inline so the schema is self-documenting.
  source: string;
  // Optional gotchas, validation hints, or convention warnings.
  notes?: string;
};

// ---------------------------------------------------------------------------
// CANONICAL FIELD LIST
// Curated for V1 to cover credit-card, auto-deficiency, and medical asset
// classes — the three most common tape types in the secondary market.
// Cross-asset fields (judgment, scrubs) and chain-of-custody fields apply
// universally.
// ---------------------------------------------------------------------------

export const CANONICAL_FIELDS: CanonicalField[] = [
  // ========================================================================
  // ACCOUNT IDENTITY
  // ========================================================================
  {
    name: "original_account_number",
    label: "Original account number",
    category: "account_identity",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: true,
    aliases: [
      /^acct[ _]?(no|num|number|#)?$/i,
      /^account[ _]?(no|num|number|#)?$/i,
      /^card[ _]?(no|num|number|#)?$/i,
      /^loan[ _]?(no|num|number|id|#)?$/i,
      /^oc[ _]?acct[ _]?(no|num|#)?$/i,
      /^originator[ _]?account[ _]?(no|number)?$/i,
      /^original[ _]?account[ _]?(no|number)?$/i,
    ],
    description: "Originator's account number. Required on every validation notice.",
    source: "Reg F §1006.34(c)(2)(iv); Spiegel-Midland §1.5; FTC 2013 Debt Buyer Study",
    notes:
      "Often masked to last-4 (XXXXXXXXXXXX5678). Courts have voided cases where Bill of Sale account # didn't match the suit account # — usually the seller used OC's # on the BoS but the buyer cited its own internal ID.",
  },
  {
    name: "seller_account_number",
    label: "Seller internal account #",
    category: "account_identity",
    criticality: "important",
    dataType: "string",
    isPii: true,
    aliases: [
      /^seller[ _]?acct[ _]?(no|num|#)?$/i,
      /^internal[ _]?(id|account|acct)$/i,
      /^file[ _]?(no|#)?$/i,
      /^reference[ _]?(no|number)?$/i,
    ],
    description: "Seller's internal ID for this account, distinct from OC account #.",
    source: "Spiegel-Midland §1.5; Langel Firm debt-buyer-defense series",
  },

  // ========================================================================
  // CONSUMER IDENTITY (PII)
  // ========================================================================
  {
    name: "first_name",
    label: "First name",
    category: "consumer_identity",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: true,
    aliases: [/^first[ _]?name$/i, /^fname$/i, /^given[ _]?name$/i],
    description: "Consumer first name. Required for validation notice salutation.",
    source: "Reg F §1006.34(c)(2)(i)(A); Spiegel-Midland (iii)",
  },
  {
    name: "last_name",
    label: "Last name",
    category: "consumer_identity",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: true,
    aliases: [/^last[ _]?name$/i, /^lname$/i, /^surname$/i, /^family[ _]?name$/i],
    description: "Consumer last name.",
    source: "Reg F §1006.34(c)(2)(i)(A); Spiegel-Midland (iii)",
  },
  {
    name: "full_name",
    label: "Full name",
    category: "consumer_identity",
    criticality: "important",
    dataType: "string",
    isPii: true,
    aliases: [
      /^full[ _]?name$/i,
      /^name$/i,
      /^debtor[ _]?name$/i,
      /^borrower[ _]?name$/i,
      /^obligor[ _]?(name|full[ _]?name)?$/i,
      /^customer[ _]?name$/i,
      /^consumer$/i,
      /^card[ _]?member$/i,
      /^account[ _]?holder$/i,
    ],
    description: "Combined name field when first/last not split.",
    source: "Spiegel-Midland 'Computer File' (iii); FTC 2013",
    notes: "Watch for embedded suffixes (Jr/Sr/III) that break suit caption parsing.",
  },
  {
    name: "co_obligor_name",
    label: "Co-obligor / co-signer name",
    category: "consumer_identity",
    criticality: "important",
    dataType: "string",
    isPii: true,
    aliases: [
      /^co[ _]?(debtor|borrower|obligor|signer|maker)$/i,
      /^joint[ _]?(obligor|holder)?$/i,
      /^cosigner$/i,
    ],
    description: "Co-signer or joint account holder. Not the same as authorized user.",
    source: "Spiegel-Midland; bill-of-sale secondary obligor",
    notes:
      "For student loans, cosigner is often the prime collection target. Authorized users are NOT obligors and cannot be pursued.",
  },
  {
    name: "ssn",
    label: "Social Security number",
    category: "consumer_identity",
    criticality: "critical",
    dataType: "string",
    isPii: true,
    aliases: [
      /^ssn$/i,
      /^social[ _]?(security)?[ _]?(no|number)?$/i,
      /^tin$/i,
      /^tax[ _]?id$/i,
    ],
    description: "SSN or TIN. Used for skip-trace, credit pulls, deceased/SCRA scrubs.",
    source: "Spiegel-Midland (iv); OCC 2014-37; FTC 2013",
    notes:
      "Formats vary: nnn-nn-nnnn, nnnnnnnnn, XXX-XX-nnnn (last-4 masked). FCRA/GLBA-protected — handle accordingly.",
  },
  {
    name: "ssn_last_4",
    label: "SSN last-4",
    category: "consumer_identity",
    criticality: "important",
    dataType: "string",
    isPii: true,
    aliases: [
      /^ssn[ _]?(last|l)[ _]?4$/i,
      /^last[ _]?4[ _]?(ssn|of[ _]?ssn)?$/i,
      /^ssn[ _]?4$/i,
    ],
    description: "Last 4 digits of SSN — common privacy-respecting alternative.",
    source: "FTC 2013 Debt Buyer Study (frequent in modern tapes)",
  },
  {
    name: "date_of_birth",
    label: "Date of birth",
    category: "consumer_identity",
    criticality: "critical",
    dataType: "date",
    isPii: true,
    aliases: [/^d[ _]?o[ _]?b$/i, /^date[ _]?of[ _]?birth$/i, /^birth[ _]?date$/i, /^born$/i],
    description: "Required for SCRA, deceased, and PACER litigious-consumer matching.",
    source: "Spiegel-Midland; SCRA active-duty match requirement",
  },

  // ========================================================================
  // CONSUMER CONTACT (PII; required for outreach + venue)
  // ========================================================================
  {
    name: "street_address",
    label: "Street address",
    category: "consumer_contact",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: true,
    aliases: [
      /^address(_?1|[ _]?line[ _]?1)?$/i,
      /^street(_?address)?$/i,
      /^mailing[ _]?address$/i,
      /^service[ _]?address$/i,
      /^last[ _]?known[ _]?address$/i,
      /^lka$/i,
    ],
    description: "Last known mailing/service address. Required for validation notice.",
    source: "Reg F §1006.34(c)(2)(i)(B); Spiegel-Midland (iii)",
  },
  {
    name: "address_line_2",
    label: "Address line 2",
    category: "consumer_contact",
    criticality: "optional",
    dataType: "string",
    isPii: true,
    aliases: [
      /^address[ _]?2$/i,
      /^addr[ _]?(line[ _]?)?2$/i,
      /^suite$/i,
      /^apt$/i,
      /^unit$/i,
    ],
    description: "Apartment, suite, or unit.",
    source: "USPS standard mail format",
  },
  {
    name: "city",
    label: "City",
    category: "consumer_contact",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: true,
    aliases: [/^city$/i, /^town$/i, /^municipality$/i],
    description: "City of consumer address.",
    source: "Reg F §1006.34(c)(2)(i)(B)",
  },
  {
    name: "state",
    label: "State",
    category: "consumer_contact",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: false, // 2-letter state code is not PII on its own
    aliases: [
      /^state$/i,
      /^st$/i,
      /^billing[ _]?state$/i,
      /^debtor[ _]?state$/i,
      /^addr[ _]?state$/i,
      /^state[ _]?of[ _]?residence$/i,
    ],
    description: "State of consumer residence. Drives SOL choice-of-law and venue.",
    source: "Reg F §1006.34(c)(2)(i)(B); SOL analysis foundation",
    notes:
      "Spiegel-Midland: 'Buyer agrees that it shall be responsible to determine the applicable Statute of Limitations.' Never trust a seller-provided SOL field.",
  },
  {
    name: "zip_code",
    label: "ZIP code",
    category: "consumer_contact",
    criticality: "important",
    dataType: "string",
    isPii: false,
    aliases: [/^zip(code)?$/i, /^postal(_?code)?$/i, /^zip[ _]?5$/i, /^zip[ _]?9$/i],
    description: "5- or 9-digit ZIP. Drives skip-trace and FICO geo overlays.",
    source: "dv01 schema; Spiegel-Midland",
  },
  {
    name: "phone_primary",
    label: "Primary phone",
    category: "consumer_contact",
    criticality: "important",
    dataType: "string",
    isPii: true,
    aliases: [
      /^phone$/i,
      /^home[ _]?phone$/i,
      /^primary[ _]?phone$/i,
      /^telephone$/i,
      /^phone[ _]?1$/i,
      /^phone[ _]?number$/i,
    ],
    description: "Primary phone. TCPA-sensitive — must be DNC/reassigned-number scrubbed.",
    source: "Spiegel-Midland (iii); FTC 2013; TCPA",
  },
  {
    name: "phone_secondary",
    label: "Secondary phone",
    category: "consumer_contact",
    criticality: "optional",
    dataType: "string",
    isPii: true,
    aliases: [
      /^mobile[ _]?phone$/i,
      /^cell[ _]?phone$/i,
      /^secondary[ _]?phone$/i,
      /^phone[ _]?2$/i,
      /^work[ _]?phone$/i,
    ],
    description: "Mobile, work, or alternate phone.",
    source: "Spiegel-Midland; FTC 2013",
  },
  {
    name: "email",
    label: "Email",
    category: "consumer_contact",
    criticality: "optional",
    dataType: "string",
    isPii: true,
    aliases: [/^email([ _]?address)?$/i, /^e[ _]?mail$/i],
    description: "Email address. Reg F §1006.6 allows email notices with consent.",
    source: "Reg F §1006.6 e-comm rules",
  },

  // ========================================================================
  // BALANCE / FINANCIAL
  // ========================================================================
  {
    name: "charge_off_balance",
    label: "Charge-off balance",
    category: "balance_financial",
    criticality: "reg_f_minimum",
    dataType: "number",
    isPii: false,
    aliases: [
      /^charge[ _]?off[ _]?balance$/i,
      /^co[ _]?balance$/i,
      /^charged[ _]?off[ _]?balance$/i,
      /^charge[ _]?off[ _]?amount$/i,
    ],
    description: "Balance as of charge-off date. Reg F itemization anchor.",
    source: "Reg F §1006.34(c)(2)(vii)(F); Spiegel-Midland 'Account Balance'",
    notes:
      "Spiegel convention: EXCLUDES post-CO interest and fees. CompuCredit/Encore 'Cut-off Claim Amount' convention INCLUDES pre-CO interest, fees, assessments. A 5%+ disagreement between charge_off_balance and account_balance flags mixed convention.",
  },
  {
    name: "account_balance",
    label: "Current account balance",
    category: "balance_financial",
    criticality: "critical",
    dataType: "number",
    isPii: false,
    aliases: [
      /^(account[ _]?)?balance$/i,
      /^current[ _]?balance$/i,
      /^outstanding[ _]?balance$/i,
      /^face[ _]?value$/i,
      /^upb$/i,
      /^unpaid[ _]?principal[ _]?balance$/i,
      /^total[ _]?owed$/i,
      /^amount[ _]?owed$/i,
      /^cut[ _]?off[ _]?claim[ _]?amount$/i, // CompuCredit/Encore convention
      /^approximate[ _]?current[ _]?balance$/i,
    ],
    description: "Current outstanding balance at cut-off date. Drives purchase price.",
    source: "Spiegel-Midland 'Account Balance'; Encore §1.18; Reg F §1006.34(c)(2)(vii)(F)",
    notes:
      "'Cut-off Claim Amount' = balance + pre-CO interest/fees (CompuCredit/Encore convention). 'Account Balance' on Spiegel-style tapes EXCLUDES post-CO interest/fees. The decoder must detect which convention and warn the buyer — convention mismatch is a 10–30% mispricing bomb.",
  },
  {
    name: "principal_balance",
    label: "Principal balance",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^principal(_?balance)?$/i,
      /^principal[ _]?owed$/i,
      /^principal[ _]?amount$/i,
    ],
    description: "Principal portion of balance, exclusive of interest/fees.",
    source: "Reg F §1006.34(c)(2)(vii); Spiegel-Midland",
  },
  {
    name: "interest_balance",
    label: "Interest balance",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^interest(_?balance)?$/i,
      /^accrued[ _]?interest$/i,
      /^interest[ _]?owed$/i,
    ],
    description: "Accrued interest portion of balance.",
    source: "Reg F §1006.34(c)(2)(vii)(B)",
  },
  {
    name: "fee_balance",
    label: "Fees and charges",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^fees?(_?balance)?$/i,
      /^late[ _]?fees?$/i,
      /^charges?$/i,
      /^assessments?$/i,
    ],
    description: "Fees and other charges portion of balance.",
    source: "Reg F §1006.34(c)(2)(vii)(C); Encore consent order",
  },
  {
    name: "itemization_amount",
    label: "Itemization amount",
    category: "balance_financial",
    criticality: "reg_f_minimum",
    dataType: "number",
    isPii: false,
    aliases: [
      /^itemization[ _]?amount$/i,
      /^validation[ _]?balance$/i,
      /^itemization[ _]?balance$/i,
    ],
    description: "Balance as of the itemization date. Reg F validation-notice key field.",
    source: "Reg F §1006.34(b)(3)(i)",
    notes:
      "Reg F lets the COLLECTOR pick one of 5 itemization dates (charge-off being most common). Spiegel-Midland anchors balance to seller-set 'Cut-off Date' — these are different dates and the tape rarely labels which. Robust decoder must infer or ask.",
  },
  {
    name: "original_loan_amount",
    label: "Original loan / credit limit",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^original[ _]?(loan|amount|balance)$/i,
      /^credit[ _]?limit$/i,
      /^high[ _]?credit$/i,
      /^purchase[ _]?price$/i, // auto context
      /^loan[ _]?amount$/i,
    ],
    description: "Original credit limit (CC) or principal amount (loan).",
    source: "FTC 2013; Encore §1.20",
  },
  {
    name: "last_payment_amount",
    label: "Last payment amount",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^last[ _]?payment[ _]?amount$/i,
      /^last[ _]?pmt[ _]?\$?$/i,
      /^lpa$/i,
    ],
    description: "Amount of consumer's last payment. Used in re-aging analysis.",
    source: "Spiegel-Midland (vi)",
  },
  {
    name: "interest_rate_at_co",
    label: "APR / contract rate",
    category: "balance_financial",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^apr$/i,
      /^interest[ _]?rate$/i,
      /^contract[ _]?rate$/i,
      /^note[ _]?rate$/i,
      /^cash[ _]?apr$/i,
      /^purchase[ _]?apr$/i,
    ],
    description: "Contract APR. Used for permissible-interest re-aging and SOL.",
    source: "Spiegel-Midland (vii); Encore consent order (contract interest rate)",
  },

  // ========================================================================
  // DATES (foundation for SOL and FCRA)
  // ========================================================================
  {
    name: "charge_off_date",
    label: "Charge-off date",
    category: "dates",
    criticality: "reg_f_minimum",
    dataType: "date",
    isPii: false,
    aliases: [
      /^charge[ _]?off[ _]?date$/i,
      /^co[ _]?date$/i,
      /^d[ _]?c[ _]?o$/i,
      /^doco$/i,
      /^date[ _]?of[ _]?charge[ _]?off$/i,
      /^write[ _]?off[ _]?date$/i,
    ],
    description: "Date account was charged off. Reg F itemization-date option and CRA 180-day delete clock.",
    source: "Reg F §1006.34(b)(3)(ii); Spiegel-Midland (viii); FTC 2013",
  },
  {
    name: "last_payment_date",
    label: "Last payment date",
    category: "dates",
    criticality: "reg_f_minimum",
    dataType: "date",
    isPii: false,
    aliases: [
      /^last[ _]?payment[ _]?date$/i,
      /^lpd$/i,
      /^dlp$/i,
      /^date[ _]?of[ _]?last[ _]?payment$/i,
      /^last[ _]?pay[ _]?date$/i,
      /^last[ _]?pmt[ _]?dt$/i,
    ],
    description: "Date of consumer's last payment. THE most important field for SOL math.",
    source: "Spiegel-Midland (v); FTC 2013; Reg F §1006.34(b)(3)(iii)",
    notes:
      "Statutes run from this date in most states. Sentinel values ('00/00/0000', '1/1/1900') often mean no payment ever made — decoder must detect and route to open-date SOL fallback.",
  },
  {
    name: "date_of_first_delinquency",
    label: "Date of first delinquency",
    category: "dates",
    criticality: "critical",
    dataType: "date",
    isPii: false,
    aliases: [
      /^date[ _]?of[ _]?first[ _]?delinquency$/i,
      /^dofd$/i,
      /^first[ _]?delinquency[ _]?date$/i,
      /^fdd$/i,
    ],
    description: "Required for FCRA 7-year credit-reporting deletion clock.",
    source: "FCRA §605(a)(4); CFPB Encore consent order",
  },
  {
    name: "itemization_date",
    label: "Itemization date",
    category: "dates",
    criticality: "reg_f_minimum",
    dataType: "date",
    isPii: false,
    aliases: [
      /^itemization[ _]?date$/i,
      /^itemization[ _]?dt$/i,
      /^validation[ _]?date$/i,
    ],
    description: "Reg F-compliant itemization date for validation notice.",
    source: "Reg F §1006.34(b)(3)",
    notes:
      "Reg F allows 5 options: last-statement, charge-off, last-payment, transaction, or judgment date. Seller often doesn't label which — buyer's collector chooses.",
  },
  {
    name: "account_opened_date",
    label: "Account opened date",
    category: "dates",
    criticality: "critical",
    dataType: "date",
    isPii: false,
    aliases: [
      /^open(ed)?[ _]?date$/i,
      /^origination[ _]?date$/i,
      /^date[ _]?(account[ _]?)?opened$/i,
      /^booked[ _]?date$/i,
      /^acct[ _]?open[ _]?date$/i,
    ],
    description: "Date account was originated. SOL clock anchor in some states.",
    source: "Spiegel-Midland (ix); CFPB Encore (dates of origination); FTC 2013",
  },
  {
    name: "last_statement_date",
    label: "Last statement date",
    category: "dates",
    criticality: "important",
    dataType: "date",
    isPii: false,
    aliases: [
      /^last[ _]?statement[ _]?date$/i,
      /^lsd$/i,
      /^statement[ _]?date$/i,
    ],
    description: "Date of last statement issued — one Reg F itemization-date option.",
    source: "Reg F §1006.34(b)(3)(i)",
  },
  {
    name: "cutoff_date",
    label: "Cut-off / as-of date",
    category: "dates",
    criticality: "critical",
    dataType: "date",
    isPii: false,
    aliases: [
      /^cut[ _]?off[ _]?date$/i,
      /^as[ _]?of[ _]?date$/i,
      /^snapshot[ _]?date$/i,
      /^file[ _]?date$/i,
    ],
    description: "Defines as-of for balances; payments after cutoff belong to seller.",
    source: "Spiegel-Midland 'Cut-off Date'; Encore §1.19",
  },
  {
    name: "sale_date",
    label: "Sale / closing date",
    category: "dates",
    criticality: "critical",
    dataType: "date",
    isPii: false,
    aliases: [
      /^sale[ _]?date$/i,
      /^closing[ _]?date$/i,
      /^transfer[ _]?date$/i,
      /^assignment[ _]?date$/i,
    ],
    description: "Date of sale to current buyer. Marks chain-of-title link.",
    source: "Spiegel-Midland 'Closing'",
  },

  // ========================================================================
  // DEBT CHARACTERISTICS
  // ========================================================================
  {
    name: "asset_type",
    label: "Asset type / debt type",
    category: "debt_characteristics",
    criticality: "critical",
    dataType: "string",
    isPii: false,
    aliases: [
      /^asset[ _]?(type|class)$/i,
      /^debt[ _]?type$/i,
      /^product(_?type)?$/i,
      /^loan[ _]?type$/i,
      /^class$/i,
      /^portfolio[ _]?type$/i,
    ],
    description: "Asset class: credit card, auto, medical, student, mortgage, etc.",
    source: "FTC 2013 (9 categories); RMAI asset-class papers",
  },
  {
    name: "product_subtype",
    label: "Product subtype",
    category: "debt_characteristics",
    criticality: "optional",
    dataType: "string",
    isPii: false,
    aliases: [
      /^product[ _]?(name|brand|sub[ _]?type)$/i,
      /^card[ _]?type$/i,
      /^private[ _]?label$/i,
      /^brand$/i,
      /^store[ _]?name$/i,
    ],
    description: "Product subtype (e.g., Platinum, Cash Back, private-label brand).",
    source: "RMAI fintech-asset-class paper",
  },
  {
    name: "collateral_description",
    label: "Collateral / VIN / property",
    category: "debt_characteristics",
    criticality: "critical", // critical for auto/mortgage, optional otherwise
    dataType: "string",
    isPii: true, // VIN + property = identifies consumer
    aliases: [
      /^vin$/i,
      /^vehicle[ _]?id$/i,
      /^collateral([ _]?desc(ription)?)?$/i,
      /^property[ _]?(address|description)?$/i,
    ],
    description: "Collateral: VIN (auto), property address (mortgage), serial # (equipment).",
    source: "OCC 2014-37; standard secured-debt tape practice",
  },

  // ========================================================================
  // ORIGINAL CREDITOR (critical for chain-of-custody)
  // ========================================================================
  {
    name: "originating_creditor",
    label: "Originating creditor",
    category: "original_creditor",
    criticality: "reg_f_minimum",
    dataType: "string",
    isPii: false,
    aliases: [
      /^original[ _]?creditor$/i,
      /^originating[ _]?creditor$/i,
      /^oc$/i,
      /^issuer$/i,
      /^original[ _]?lender$/i,
      /^issuing[ _]?bank$/i,
    ],
    description: "Name of original creditor. Required by Reg F validation notice.",
    source: "Reg F §1006.34(c)(2)(iii); OCC 2014-37; Encore 2005 8-K §1.33",
    notes:
      "Drives SOL choice-of-law analysis. For fintech-issued cards, the bank-of-record (issuer) is often different from the consumer-facing brand.",
  },
  {
    name: "originator_name",
    label: "Originator / brand name",
    category: "original_creditor",
    criticality: "critical",
    dataType: "string",
    isPii: false,
    aliases: [/^originator(_?name)?$/i, /^brand[ _]?name$/i],
    description: "Consumer-facing brand. For fintech, often differs from issuing bank.",
    source: "RMAI fintech asset-class paper",
  },
  {
    name: "current_creditor",
    label: "Current creditor / seller",
    category: "original_creditor",
    criticality: "important",
    dataType: "string",
    isPii: false,
    aliases: [
      /^current[ _]?(creditor|holder|owner)$/i,
      /^seller$/i,
      /^assignor$/i,
    ],
    description: "Current holder selling the account. Latest link in chain-of-title.",
    source: "Standard bill-of-sale field",
  },
  {
    name: "servicer_name",
    label: "Servicer / sub-servicer",
    category: "original_creditor",
    criticality: "important",
    dataType: "string",
    isPii: false,
    aliases: [
      /^servicer$/i,
      /^sub[ _]?servicer$/i,
      /^backup[ _]?servicer$/i,
      /^master[ _]?servicer$/i,
    ],
    description: "Entity that actually held the file (e.g., CardWorks Servicing).",
    source: "Spiegel-Midland 'Servicer'",
  },

  // ========================================================================
  // PRIOR COLLECTION ACTIVITY
  // ========================================================================
  {
    name: "prior_placements_count",
    label: "Prior placements count",
    category: "prior_collection",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^prior[ _]?placements?$/i,
      /^number[ _]?of[ _]?placements?$/i,
      /^placement[ _]?count$/i,
      /^prior[ _]?agencies$/i,
    ],
    description: "How many times account was placed with collection agencies.",
    source: "Standard secondary-market tape; staleness signal",
    notes:
      "High placement count = stale paper. Recovery curves degrade ~30-40% per placement.",
  },
  {
    name: "last_placement_date",
    label: "Last placement date",
    category: "prior_collection",
    criticality: "important",
    dataType: "date",
    isPii: false,
    aliases: [
      /^last[ _]?placement[ _]?date$/i,
      /^last[ _]?placed$/i,
      /^last[ _]?worked[ _]?date$/i,
    ],
    description: "Last time account was actively worked by a collector.",
    source: "Secondary-market standard",
  },
  {
    name: "last_placement_agency",
    label: "Last placement agency",
    category: "prior_collection",
    criticality: "optional",
    dataType: "string",
    isPii: false,
    aliases: [
      /^last[ _]?placement[ _]?agency$/i,
      /^prior[ _]?agency$/i,
      /^last[ _]?vendor$/i,
    ],
    description: "Agency that last worked the account.",
    source: "Secondary-market standard",
  },
  {
    name: "in_litigation_flag",
    label: "In-litigation flag",
    category: "prior_collection",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^in[ _]?litigation$/i,
      /^litigation[ _]?flag$/i,
      /^suit[ _]?filed$/i,
      /^lawsuit$/i,
      /^legal[ _]?status$/i,
      /^specialized[ _]?legal[ _]?file$/i, // Encore "Specialized Legal File" subset
    ],
    description: "Account is in active litigation. Different valuation profile.",
    source: "Encore 2005 §3.x 'Specialized Legal File' subset",
    notes:
      "Encore's 'Specialized Legal File' subset carries post-CO interest/fees because of judgments — different field-presence pattern WITHIN one tape. Decoder must detect mixed subsets.",
  },
  {
    name: "judgment_amount",
    label: "Judgment amount",
    category: "prior_collection",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [/^judgment[ _]?amount$/i, /^judgment[ _]?balance$/i, /^j[ _]?balance$/i],
    description: "Dollar amount of any judgment entered on this account.",
    source: "RMAI Standard #18 (judgment-receivables expansion 2024)",
  },
  {
    name: "judgment_date",
    label: "Judgment date",
    category: "prior_collection",
    criticality: "important",
    dataType: "date",
    isPii: false,
    aliases: [/^judgment[ _]?date$/i, /^date[ _]?of[ _]?judgment$/i, /^j[ _]?date$/i],
    description: "Date judgment was entered. Resets SOL clock in most states.",
    source: "Standard judgment-tape field; SOL tolling rules",
  },
  {
    name: "judgment_state",
    label: "Judgment state",
    category: "prior_collection",
    criticality: "important",
    dataType: "string",
    isPii: false,
    aliases: [/^judgment[ _]?state$/i, /^j[ _]?state$/i, /^court[ _]?state$/i],
    description: "State where judgment was entered (controls enforcement clock).",
    source: "Judgment-receivables tape standard",
  },

  // ========================================================================
  // CHAIN-OF-CUSTODY (the killer-feature category)
  // ========================================================================
  {
    name: "bill_of_sale_available",
    label: "Bill of sale available",
    category: "chain_of_custody",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^bill[ _]?of[ _]?sale([ _]?available)?$/i,
      /^bos$/i,
      /^bos[ _]?available$/i,
    ],
    description: "Bill of sale doc available for this account.",
    source: "Hartman $0-if-gap rule; standard chain-of-title requirement",
    notes:
      "Missing BoS makes the account legally indefensible in court. Hartman rule: account value = $0 if chain has a gap.",
  },
  {
    name: "prior_assignments_count",
    label: "Prior assignments count",
    category: "chain_of_custody",
    criticality: "critical",
    dataType: "number",
    isPii: false,
    aliases: [
      /^prior[ _]?assignments?$/i,
      /^assignment[ _]?count$/i,
      /^chain[ _]?length$/i,
      /^number[ _]?of[ _]?prior[ _]?holders$/i,
    ],
    description: "Number of prior assignments between OC and current seller.",
    source: "Chain-of-title standard; courts require complete chain",
    notes: "Each additional link multiplies missing-doc risk. >2 prior holders = high evidentiary risk.",
  },
  {
    name: "affidavit_of_debt_available",
    label: "Affidavit of debt available",
    category: "chain_of_custody",
    criticality: "important",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^a[ _]?o[ _]?d$/i,
      /^affidavit([ _]?of[ _]?debt)?([ _]?available)?$/i,
    ],
    description: "Custodian-of-records affidavit available (alternative to full docs).",
    source: "Spiegel-Midland §3.2 'affidavits of debt in a form mutually agreeable'",
  },
  {
    name: "media_available_flag",
    label: "Account media available",
    category: "chain_of_custody",
    criticality: "important",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^media[ _]?available$/i,
      /^docs[ _]?available$/i,
      /^statements[ _]?available$/i,
      /^itemization[ _]?available$/i,
    ],
    description: "Origination docs / statement history available on demand.",
    source: "OCC 2014-37; CFPB Encore consent order (OALD)",
  },

  // ========================================================================
  // SCRUB STATUS
  // ========================================================================
  {
    name: "bankruptcy_flag",
    label: "Bankruptcy flag",
    category: "scrub_status",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^bankruptcy([ _]?flag)?$/i,
      /^bk([ _]?flag)?$/i,
      /^in[ _]?bk$/i,
    ],
    description: "Consumer has filed bankruptcy (any chapter).",
    source: "OCC 2014-37 mandatory scrub field",
    notes: "Active BK = automatic stay. Discharged Ch.7 unsecured = uncollectable.",
  },
  {
    name: "bankruptcy_chapter",
    label: "Bankruptcy chapter",
    category: "scrub_status",
    criticality: "important",
    dataType: "enum",
    isPii: false,
    aliases: [/^bk[ _]?chapter$/i, /^bankruptcy[ _]?chapter$/i, /^ch(ap(ter)?)?$/i],
    description: "Chapter 7, 11, 13. Determines whether debt was discharged.",
    source: "Bankruptcy Code; PACER",
  },
  {
    name: "bankruptcy_filing_date",
    label: "Bankruptcy filing date",
    category: "scrub_status",
    criticality: "important",
    dataType: "date",
    isPii: false,
    aliases: [
      /^bk[ _]?filing[ _]?date$/i,
      /^bankruptcy[ _]?date$/i,
      /^bk[ _]?date$/i,
    ],
    description: "Date BK was filed. Determines whether this debt is pre/post-petition.",
    source: "PACER; bankruptcy practice",
  },
  {
    name: "deceased_flag",
    label: "Deceased flag",
    category: "scrub_status",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^deceased([ _]?flag)?$/i,
      /^date[ _]?of[ _]?death$/i,
      /^dod$/i,
    ],
    description: "Consumer is deceased per SSDMF or seller records.",
    source: "SSDMF; OCC 2014-37",
    notes: "Cannot collect from deceased consumer unless estate is open.",
  },
  {
    name: "scra_active_duty_flag",
    label: "SCRA active duty flag",
    category: "scrub_status",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^scra([ _]?flag)?$/i,
      /^active[ _]?duty([ _]?flag)?$/i,
      /^military([ _]?status)?$/i,
    ],
    description: "Consumer is active-duty military — SCRA protections apply.",
    source: "Servicemembers Civil Relief Act; DOD scra.dmdc.osd.mil",
    notes: "Cap on interest, limits on suit, foreclosure protections.",
  },
  {
    name: "fraud_flag",
    label: "Fraud / ID theft flag",
    category: "scrub_status",
    criticality: "critical",
    dataType: "bool",
    isPii: false,
    aliases: [
      /^fraud([ _]?flag)?$/i,
      /^id[ _]?theft$/i,
      /^disputed[ _]?charge$/i,
    ],
    description: "Account is flagged for fraud or identity theft. Cannot collect.",
    source: "CFPB Encore consent order; Spiegel-Midland §6.1(c)",
  },

  // ========================================================================
  // ORIGINAL-CREDITOR DATA (Reg F + OALD requirements)
  // ========================================================================
  {
    name: "credit_bureau_reporting_status",
    label: "Credit bureau reporting status",
    category: "original_creditor",
    criticality: "important",
    dataType: "enum",
    isPii: false,
    aliases: [
      /^cbr[ _]?status$/i,
      /^reported[ _]?to[ _]?cra$/i,
      /^tradeline[ _]?active$/i,
      /^credit[ _]?reporting$/i,
    ],
    description: "Whether OC tradeline is still being reported.",
    source: "Spiegel-Midland §4.5",
  },
  {
    name: "settlement_offers_extended",
    label: "Settlement offer extended",
    category: "prior_collection",
    criticality: "important",
    dataType: "number",
    isPii: false,
    aliases: [
      /^embedded[ _]?settlement$/i,
      /^open[ _]?settlement$/i,
      /^settlement[ _]?offer$/i,
    ],
    description: "Pre-extended settlement offer the buyer inherits.",
    source: "Spiegel-Midland 'Embedded Settlement'",
    notes: "Buyer entitled to refund per Spiegel-Midland if undisclosed embedded settlement.",
  },
];

// ---------------------------------------------------------------------------
// Reg F minimum field set — 12 CFR 1006.34(c)(2)
// These 9 categories must be supportable from the tape data for the buyer
// to send a legally compliant validation notice. Missing any = buyer cannot
// legally collect until seller supplements.
// ---------------------------------------------------------------------------

export const REG_F_MINIMUM_FIELDS: ReadonlyArray<string> = [
  "original_account_number",
  "first_name", // can be satisfied by full_name if first/last not split
  "last_name", // can be satisfied by full_name
  "street_address",
  "city",
  "state",
  "originating_creditor",
  "itemization_amount", // or derivable from charge_off_balance + itemization_date
  "itemization_date", // or charge_off_date, last_statement_date, last_payment_date
];

// Helpers — name-set satisfied by either split or combined name field
function isNameSatisfied(detected: Set<string>): boolean {
  return (
    (detected.has("first_name") && detected.has("last_name")) ||
    detected.has("full_name")
  );
}

// Itemization-date Reg F flexibility: collector may use any of 5 dates.
function isItemizationDateSatisfied(detected: Set<string>): boolean {
  return (
    detected.has("itemization_date") ||
    detected.has("charge_off_date") ||
    detected.has("last_statement_date") ||
    detected.has("last_payment_date")
  );
}

// Itemization-amount Reg F satisfaction: explicit field OR can derive from
// charge_off_balance + components.
function isItemizationAmountSatisfied(detected: Set<string>): boolean {
  return (
    detected.has("itemization_amount") ||
    detected.has("charge_off_balance") ||
    detected.has("account_balance")
  );
}

// ---------------------------------------------------------------------------
// Detection — map raw headers to canonical fields with confidence scores
// ---------------------------------------------------------------------------

export type FieldMatch = {
  canonical: string; // canonical field name
  header: string; // the source header that matched
  confidence: number; // 0..1
};

export type SchemaDetection = {
  matches: FieldMatch[];
  unmappedHeaders: string[];
  byCanonical: Map<string, FieldMatch>; // canonical -> first/best match
  piiHeadersDetected: string[]; // headers we identified as PII (won't read values)
};

export function detectCanonicalFields(headers: string[]): SchemaDetection {
  const matches: FieldMatch[] = [];
  const byCanonical = new Map<string, FieldMatch>();
  const matchedHeaders = new Set<string>();
  const piiHeadersDetected: string[] = [];

  for (const rawHeader of headers) {
    const h = rawHeader.trim();
    if (!h) continue;

    let bestField: CanonicalField | null = null;
    let bestConfidence = 0;

    for (const field of CANONICAL_FIELDS) {
      for (const pattern of field.aliases) {
        if (pattern.test(h)) {
          // First alias in the list is highest confidence; later aliases
          // are common-but-less-specific. Use position-weighted confidence.
          const idx = field.aliases.indexOf(pattern);
          const conf = 1.0 - 0.1 * Math.min(idx, 5); // 1.0, 0.9, 0.8, …, capped at 0.5
          if (conf > bestConfidence) {
            bestConfidence = conf;
            bestField = field;
          }
          break;
        }
      }
    }

    if (bestField) {
      const match: FieldMatch = {
        canonical: bestField.name,
        header: h,
        confidence: bestConfidence,
      };
      matches.push(match);
      matchedHeaders.add(h);
      if (bestField.isPii) piiHeadersDetected.push(h);
      // Keep the highest-confidence match per canonical field
      const existing = byCanonical.get(bestField.name);
      if (!existing || match.confidence > existing.confidence) {
        byCanonical.set(bestField.name, match);
      }
    }
  }

  const unmappedHeaders = headers
    .map((h) => h.trim())
    .filter((h) => h && !matchedHeaders.has(h));

  return { matches, unmappedHeaders, byCanonical, piiHeadersDetected };
}

// ---------------------------------------------------------------------------
// Reg F minimum-field compliance check
// ---------------------------------------------------------------------------

export type RegFCheckResult = {
  pass: boolean;
  missing: string[]; // canonical names (or descriptive groups like "name")
  satisfiedBy: Map<string, string>; // requirement -> how it was satisfied
};

export function checkRegFMinimum(detection: SchemaDetection): RegFCheckResult {
  const detected = new Set(detection.byCanonical.keys());
  const missing: string[] = [];
  const satisfiedBy = new Map<string, string>();

  if (detection.byCanonical.has("original_account_number")) {
    satisfiedBy.set(
      "original_account_number",
      detection.byCanonical.get("original_account_number")!.header
    );
  } else {
    missing.push("original_account_number");
  }

  if (isNameSatisfied(detected)) {
    const how =
      detected.has("first_name") && detected.has("last_name")
        ? `${detection.byCanonical.get("first_name")!.header} + ${detection.byCanonical.get("last_name")!.header}`
        : detection.byCanonical.get("full_name")!.header;
    satisfiedBy.set("consumer_name", how);
  } else {
    missing.push("consumer_name (need first+last OR full_name)");
  }

  for (const addrField of ["street_address", "city", "state"] as const) {
    if (detection.byCanonical.has(addrField)) {
      satisfiedBy.set(addrField, detection.byCanonical.get(addrField)!.header);
    } else {
      missing.push(addrField);
    }
  }

  if (detection.byCanonical.has("originating_creditor")) {
    satisfiedBy.set(
      "originating_creditor",
      detection.byCanonical.get("originating_creditor")!.header
    );
  } else {
    missing.push("originating_creditor");
  }

  if (isItemizationAmountSatisfied(detected)) {
    const how =
      detection.byCanonical.get("itemization_amount")?.header ??
      detection.byCanonical.get("charge_off_balance")?.header ??
      detection.byCanonical.get("account_balance")!.header;
    satisfiedBy.set("itemization_amount", `derivable from ${how}`);
  } else {
    missing.push("itemization_amount (need itemization_amount, charge_off_balance, or account_balance)");
  }

  if (isItemizationDateSatisfied(detected)) {
    const how =
      detection.byCanonical.get("itemization_date")?.header ??
      detection.byCanonical.get("charge_off_date")?.header ??
      detection.byCanonical.get("last_statement_date")?.header ??
      detection.byCanonical.get("last_payment_date")!.header;
    satisfiedBy.set("itemization_date", `pickable from ${how}`);
  } else {
    missing.push(
      "itemization_date (need any of: itemization_date, charge_off_date, last_statement_date, last_payment_date)"
    );
  }

  return { pass: missing.length === 0, missing, satisfiedBy };
}

// ---------------------------------------------------------------------------
// Completeness scoring — % of fields detected, broken down by criticality
// ---------------------------------------------------------------------------

export type CompletenessScore = {
  overall: number; // 0..1 across all canonical fields
  weighted: number; // 0..1, weighted by criticality
  byCriticality: Record<FieldCriticality, { detected: number; total: number }>;
  byCategory: Record<FieldCategory, { detected: number; total: number }>;
  // Headline "schema grade": A-F based on weighted completeness + Reg F pass
  grade: "A" | "B" | "C" | "D" | "F";
};

const CRITICALITY_WEIGHT: Record<FieldCriticality, number> = {
  reg_f_minimum: 5,
  critical: 3,
  important: 2,
  optional: 1,
  cosmetic: 0.5,
};

export function computeCompleteness(
  detection: SchemaDetection,
  regF: RegFCheckResult
): CompletenessScore {
  const detected = detection.byCanonical;

  const byCriticality = {
    reg_f_minimum: { detected: 0, total: 0 },
    critical: { detected: 0, total: 0 },
    important: { detected: 0, total: 0 },
    optional: { detected: 0, total: 0 },
    cosmetic: { detected: 0, total: 0 },
  } as Record<FieldCriticality, { detected: number; total: number }>;

  const byCategory = {} as Record<FieldCategory, { detected: number; total: number }>;
  for (const cat of [
    "account_identity",
    "consumer_identity",
    "consumer_contact",
    "balance_financial",
    "dates",
    "debt_characteristics",
    "prior_collection",
    "chain_of_custody",
    "scrub_status",
    "original_creditor",
  ] as FieldCategory[]) {
    byCategory[cat] = { detected: 0, total: 0 };
  }

  let weightedNum = 0;
  let weightedDen = 0;

  for (const field of CANONICAL_FIELDS) {
    byCriticality[field.criticality].total++;
    byCategory[field.category].total++;
    weightedDen += CRITICALITY_WEIGHT[field.criticality];
    if (detected.has(field.name)) {
      byCriticality[field.criticality].detected++;
      byCategory[field.category].detected++;
      weightedNum += CRITICALITY_WEIGHT[field.criticality];
    }
  }

  const overall = detected.size / CANONICAL_FIELDS.length;
  const weighted = weightedDen === 0 ? 0 : weightedNum / weightedDen;

  // Grade: weighted score gated by Reg F pass. Fail Reg F → max C.
  let grade: CompletenessScore["grade"];
  if (!regF.pass) {
    grade = weighted >= 0.5 ? "C" : weighted >= 0.3 ? "D" : "F";
  } else if (weighted >= 0.85) grade = "A";
  else if (weighted >= 0.7) grade = "B";
  else if (weighted >= 0.5) grade = "C";
  else if (weighted >= 0.3) grade = "D";
  else grade = "F";

  return { overall, weighted, byCriticality, byCategory, grade };
}

// ---------------------------------------------------------------------------
// Null-sentinel detection — sellers often encode "no data" as values that
// LOOK like data: "00/00/0000", "1/1/1900", "9999-12-31", "0", "N/A", etc.
// Spiegel-Midland explicitly allows fields to be empty "to the extent
// applicable and available," so sentinels are legitimate signals — they
// just must not be treated as real data.
// ---------------------------------------------------------------------------

const SENTINEL_DATE_PATTERNS: RegExp[] = [
  /^0+[\/\-]0+[\/\-]0+$/, // 00/00/0000, 0-0-0000
  /^1[\/\-]1[\/\-]1900$/,
  /^01[\/\-]01[\/\-]1900$/,
  /^1900[\/\-]01[\/\-]01$/,
  /^9999[\/\-]12[\/\-]31$/,
  /^12[\/\-]31[\/\-]9999$/,
];

const SENTINEL_STRING_VALUES = new Set([
  "",
  "na",
  "n/a",
  "n.a.",
  "null",
  "none",
  "unknown",
  "unk",
  "tbd",
  "0",
  "00",
  "000",
  "0000",
  "00000",
  "------",
  "----",
  "--",
  "-",
  "?",
  "??",
]);

export function isNullSentinel(raw: string | null | undefined, dataType: CanonicalField["dataType"]): boolean {
  if (raw == null) return true;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return true;
  if (SENTINEL_STRING_VALUES.has(v)) return true;
  if (dataType === "date") {
    if (SENTINEL_DATE_PATTERNS.some((p) => p.test(v))) return true;
  }
  if (dataType === "number") {
    // Numeric sentinels: 0.00, -1, 9999, 999999
    const n = Number(v.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) return true;
    if (n === 0 && (dataType as string) === "number") return true; // zero balance often sentinel
    if (n === -1 || n === 9999 || n === 999999) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Convenience: look up a canonical field definition by name.
// ---------------------------------------------------------------------------

export function getFieldByName(name: string): CanonicalField | undefined {
  return CANONICAL_FIELDS.find((f) => f.name === name);
}
