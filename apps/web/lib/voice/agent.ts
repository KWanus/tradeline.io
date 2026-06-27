import "server-only";

import { STATE_NAMES } from "@/lib/geo/area-codes";
import type { GrowthSegment } from "@/lib/growth/store";

/**
 * Inbound voice-robot brain — a deterministic slot-filling script. Deterministic
 * (not a free LLM loop) keeps an IVR reliable and zero-latency: each turn we
 * parse the caller's speech into the one slot we're waiting on, then ask the
 * next question. The script qualifies the caller (segment, state) and gets
 * consent for how to send their free lead + sign-up link.
 *
 * Compliance note: the inbound call is the safe path. We still ask explicit
 * consent before texting (research refuted "inbound inquiry = consent"), and
 * default to email, which is outside TCPA, when consent is unclear.
 */

export type VoiceChoice = "text" | "email" | "decline";

export type VoiceSlots = {
  segment?: GrowthSegment;
  state?: string; // 2-letter
  choice?: VoiceChoice;
  email?: string;
};

export type TurnResult =
  | { kind: "ask"; say: string; slots: VoiceSlots }
  | { kind: "done"; slots: VoiceSlots };

const GREETING =
  "Thanks for calling Tradeline — we find banks and credit unions selling off non-performing loan portfolios, so debt buyers and brokers know who to call. ";

/** The opening question (also the greeting). */
export function firstPrompt(): string {
  return (
    GREETING +
    "To send you a free live deal lead, I just need a couple of quick details. " +
    "First — what best describes you: a debt buyer, a broker, a collection agency, or a fund?"
  );
}

/** Apply the caller's speech to the next pending slot and return the next step. */
export function handleTurn(slots: VoiceSlots, speech: string): TurnResult {
  const s = (speech || "").toLowerCase().trim();

  // 1) Segment
  if (!slots.segment) {
    const seg = parseSegment(s);
    const next = { ...slots, segment: seg };
    return {
      kind: "ask",
      slots: next,
      say: "Got it. And which state are you based in?",
    };
  }

  // 2) State
  if (!slots.state) {
    const st = parseState(s);
    const next = { ...slots, state: st || undefined };
    const where = st ? STATE_NAMES[st] : "your area";
    return {
      kind: "ask",
      slots: next,
      say:
        `Perfect. I can send you a live bank lead in ${where} plus a link to start a free trial. ` +
        "Is it okay to text it to this number? Say yes to text, or say email to get it by email instead.",
    };
  }

  // 3) Channel choice / consent
  if (!slots.choice) {
    const choice = parseChoice(s);
    const next = { ...slots, choice };
    if (choice === "email") {
      return {
        kind: "ask",
        slots: next,
        say: "Sure. What's the best email address? Say it slowly, including the dot com.",
      };
    }
    // text or decline → no more questions
    return { kind: "done", slots: next };
  }

  // 4) Email capture (only reached when choice === "email")
  if (slots.choice === "email" && !slots.email) {
    const email = parseSpokenEmail(s);
    return { kind: "done", slots: { ...slots, email: email || undefined } };
  }

  return { kind: "done", slots };
}

const SEGMENT_KEYWORDS: [RegExp, GrowthSegment][] = [
  [/buyer|buy|purchase|portfolio/, "debt-buyer"],
  [/broker|brokerage|broke/, "broker"],
  [/collection|agency|collect|a\.?r\.?m/, "collection-agency"],
  [/settlement|settle/, "debt-settlement"],
  [/law|attorney|legal|firm/, "law-firm"],
  [/fund|capital|investor|family office|distressed/, "fund"],
];

function parseSegment(s: string): GrowthSegment {
  for (const [re, seg] of SEGMENT_KEYWORDS) if (re.test(s)) return seg;
  return "other";
}

/** Match a spoken state name or 2-letter abbreviation. */
function parseState(s: string): string | null {
  const cleaned = s.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  // Full names first (longest match wins to avoid "new york" vs "york").
  const entries = Object.entries(STATE_NAMES).sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [code, name] of entries) {
    if (cleaned.includes(name.toLowerCase())) return code;
  }
  // Then a bare 2-letter token.
  const tok = cleaned.split(" ").find((t) => t.length === 2 && STATE_NAMES[t.toUpperCase()]);
  return tok ? tok.toUpperCase() : null;
}

function parseChoice(s: string): VoiceChoice {
  if (/email|e mail|mail it/.test(s)) return "email";
  if (/\b(no|nope|not|don't|do not|stop|remove)\b/.test(s)) return "decline";
  if (/\b(yes|yeah|yep|sure|ok|okay|text|sounds good|please|go ahead)\b/.test(s))
    return "text";
  // Ambiguous → safest is email (no SMS without clear consent).
  return "email";
}

/** Turn "pat at garnet dot com" into "pat@garnet.com" (best-effort). */
export function parseSpokenEmail(s: string): string | null {
  let t = ` ${s.toLowerCase()} `;
  t = t
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+underscore\s+/g, "_")
    .replace(/\s+dash\s+|\s+hyphen\s+/g, "-")
    .replace(/\s+/g, "");
  // If they spoke a literal address, it may already contain @ and .
  const m = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return m ? m[0] : null;
}
