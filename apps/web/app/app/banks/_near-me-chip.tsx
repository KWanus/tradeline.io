"use client";

import Link from "next/link";
import { useBuyerProfile } from "@/lib/buyer-profile";

// Full state-name -> 2-letter code, so a profile that stored "Virginia" still
// resolves. The profile field asks for a code ("VA"), but be defensive.
const NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "puerto rico": "PR",
};

function normalizeState(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.length === 2) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}

/**
 * "Near me" filter chip, driven by the buyer's saved license state. Renders
 * as the first, highlighted chip in the location filter so a buyer is one
 * click from the community banks & credit unions shedding paper in their own
 * state. Returns null until a profile state is set (and on the server), so it
 * never causes a hydration mismatch.
 */
export function NearMeChip({
  activeLoc,
  countsByState,
}: {
  activeLoc: string;
  countsByState: Record<string, number>;
}) {
  const [profile] = useBuyerProfile();
  const code = normalizeState(profile.state);
  if (!code) return null;

  const count = countsByState[code] || 0;
  const active = activeLoc.toUpperCase() === code;

  return (
    <Link
      href={`/app/banks?loc=${code}`}
      title={`Community banks & credit unions in ${code} flagged for rising charge-offs — your license state, from your profile.`}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full border transition ${
        active
          ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)]"
      }`}
    >
      <span aria-hidden>📍</span> Your area · {code}
      <span className="text-[color:var(--color-fg-faint)]">· {count}</span>
    </Link>
  );
}
