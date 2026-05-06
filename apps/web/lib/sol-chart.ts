// Statute of limitations (SOL) chart for written contracts / open accounts
// across the 50 states + DC. Numbers are years.
//
// Data is curated from public state statutes as of 2026-05-06. Some states
// distinguish between "written contract", "open account", and "promissory
// note" — we use the most common SOL applied to consumer credit-card debt
// (typically the open-account or written-contract bucket). Always verify
// with state-specific counsel before acting on any SOL conclusion.
//
// Asset-class adjustments (rough rules):
//   Auto loans → typically follow "written contract" SOL of the state
//   Junior mortgages → typically 6-15 years, longer than unsecured
//   Medical debt → many states treat as "open account"; Maryland has special rules

export type SolEntry = {
  state: string;             // 2-letter code
  name: string;              // full name
  cc: number;                // credit card / open account, years
  written: number;           // written contract, years
  notes?: string;            // special concerns
};

export const SOL_CHART: SolEntry[] = [
  { state: "AL", name: "Alabama", cc: 3, written: 6 },
  { state: "AK", name: "Alaska", cc: 3, written: 3 },
  { state: "AZ", name: "Arizona", cc: 3, written: 6 },
  { state: "AR", name: "Arkansas", cc: 3, written: 5 },
  { state: "CA", name: "California", cc: 4, written: 4, notes: "Restrictive collection laws; requires DCLA license + $25k bond." },
  { state: "CO", name: "Colorado", cc: 6, written: 6 },
  { state: "CT", name: "Connecticut", cc: 6, written: 6 },
  { state: "DE", name: "Delaware", cc: 3, written: 3 },
  { state: "FL", name: "Florida", cc: 4, written: 5 },
  { state: "GA", name: "Georgia", cc: 4, written: 6 },
  { state: "HI", name: "Hawaii", cc: 6, written: 6 },
  { state: "ID", name: "Idaho", cc: 4, written: 5 },
  { state: "IL", name: "Illinois", cc: 5, written: 10 },
  { state: "IN", name: "Indiana", cc: 6, written: 10 },
  { state: "IA", name: "Iowa", cc: 5, written: 10 },
  { state: "KS", name: "Kansas", cc: 3, written: 5 },
  { state: "KY", name: "Kentucky", cc: 5, written: 10 },
  { state: "LA", name: "Louisiana", cc: 3, written: 10 },
  { state: "ME", name: "Maine", cc: 6, written: 6 },
  { state: "MD", name: "Maryland", cc: 3, written: 3, notes: "Strict licensing; new medical-debt rules 2024+." },
  { state: "MA", name: "Massachusetts", cc: 6, written: 6, notes: "Aggressive consumer-protection enforcement." },
  { state: "MI", name: "Michigan", cc: 6, written: 6 },
  { state: "MN", name: "Minnesota", cc: 6, written: 6 },
  { state: "MS", name: "Mississippi", cc: 3, written: 3 },
  { state: "MO", name: "Missouri", cc: 5, written: 10 },
  { state: "MT", name: "Montana", cc: 5, written: 8 },
  { state: "NE", name: "Nebraska", cc: 4, written: 5 },
  { state: "NV", name: "Nevada", cc: 4, written: 6 },
  { state: "NH", name: "New Hampshire", cc: 3, written: 3 },
  { state: "NJ", name: "New Jersey", cc: 6, written: 6 },
  { state: "NM", name: "New Mexico", cc: 4, written: 6 },
  { state: "NY", name: "New York", cc: 3, written: 6, notes: "Major reform 2022: consumer debt SOL reduced to 3y." },
  { state: "NC", name: "North Carolina", cc: 3, written: 3 },
  { state: "ND", name: "North Dakota", cc: 6, written: 6 },
  { state: "OH", name: "Ohio", cc: 6, written: 8, notes: "Reduced from 8 to 6 in 2021." },
  { state: "OK", name: "Oklahoma", cc: 3, written: 5 },
  { state: "OR", name: "Oregon", cc: 6, written: 6 },
  { state: "PA", name: "Pennsylvania", cc: 4, written: 4 },
  { state: "RI", name: "Rhode Island", cc: 10, written: 10 },
  { state: "SC", name: "South Carolina", cc: 3, written: 3 },
  { state: "SD", name: "South Dakota", cc: 6, written: 6 },
  { state: "TN", name: "Tennessee", cc: 6, written: 6 },
  { state: "TX", name: "Texas", cc: 4, written: 4, notes: "Once SOL passes, debt is permanently uncollectable (no revival)." },
  { state: "UT", name: "Utah", cc: 4, written: 6 },
  { state: "VT", name: "Vermont", cc: 6, written: 6 },
  { state: "VA", name: "Virginia", cc: 3, written: 5 },
  { state: "WA", name: "Washington", cc: 3, written: 6 },
  { state: "WV", name: "West Virginia", cc: 5, written: 10 },
  { state: "WI", name: "Wisconsin", cc: 6, written: 6 },
  { state: "WY", name: "Wyoming", cc: 8, written: 10 },
  { state: "DC", name: "District of Columbia", cc: 3, written: 3 },
];

export const US_STATES_2_LETTER: string[] = SOL_CHART.map((s) => s.state);
