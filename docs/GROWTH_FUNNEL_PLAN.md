# Growth Funnel — geo-targeted acquisition + free-lead hook + call-in robot

A build-out plan for the next stage of the Growth Engine: target brokers/buyers
by area + state, hook them with a **real free bank lead** from the radar, and
let them **call a number** where a robot qualifies them and routes them to sign
up. Grounded in deep research (see "Compliance verdict" — it's the load-bearing
part).

> **Scope note.** Phase 0–2 below are SAFE and extend the existing email engine
> — the free-lead hook is already shipped. Phase 3 (voice) needs your Twilio
> account + a vendor choice, so it's planned, not built. Phase 4 (outbound
> SMS/calls) is the **risky path** — recommended **against** for now.

---

## Compliance verdict (read first — this drives the whole design)

Researched and adversarially verified (mid-2026). Sources in the research log.

| Channel | Verdict | Why |
|--------|---------|-----|
| **Cold B2B email** (the hook) | ✅ **Safe** with CAN-SPAM hygiene | CAN-SPAM applies to B2B with **no exemption**; up to **$53,088 per email**. Requires accurate headers, ad identification, a **valid physical postal address**, and an opt-out that works 30+ days and is honored within **10 business days**. We already do footer + instant suppression; just need the physical address + an ad-identifier line. |
| **Inbound voice robot** (they call us) | ✅ **Safe path** | Prospect initiates the call, so there's no outbound-call consent problem. This is the recommended voice play. |
| **The confirmatory text/email after an inbound call** | ⚠️ **Caution** | Research **refuted** the idea that an inbound inquiry auto-establishes consent/EBR. So: **email** the signup link (email isn't TCPA-governed), or capture **explicit verbal consent on the recorded call** before texting ("OK to text you the link?") and log it. |
| **Outbound robocalls / robotexts** (we call/text them cold) | ❌ **Risky — avoid for now** | Base TCPA still requires **prior express written consent** for autodialed/AI/prerecorded marketing to cell phones. The 2024–25 FCC "one-to-one consent" rule was **vacated and repealed** (good — that restriction is dead), but it did **not** loosen the base written-consent requirement. Also needs A2P 10DLC registration for SMS. |

**Net:** email + an inbound call-in robot is the safe, high-leverage funnel.
Outbound dialing/texting is a separate, consent-gated project — not worth the
exposure while bootstrapping.

---

## Phase 0 — CAN-SPAM hardening (safe, ~½ day) — mostly done

The growth emails already carry a footer + one-click unsubscribe + instant
suppression. To be airtight:
- [x] One-click unsubscribe (signed) + suppression at discovery and send.
- [x] Ad-identifier line in the footer ("This is a promotional message from Tradeline.").
- [x] Opt-outs honored well within 10 business days (ours are instant).
- [ ] Set `GROWTH_POSTAL_ADDRESS` (a real street address, registered USPS PO box, or CMRA mailbox) — **the one remaining legally-required field; falls back to a placeholder until set.**

## Phase 2.5 — Follow-up sequences (safe) — ✅ SHIPPED

Cold email converts on touch 2–4, not touch 1. A daily follow-up cron
(`/api/cron/growth-followup`, weekday GitHub Action) sends polite, templated
follow-ups to discovery prospects who got a first email but **haven't replied**
(reply detection via `replies.json` correlated by lead id). Configurable on
`/app/growth`: max touches + days apart. Replies and opt-outs stop the sequence;
suppression is enforced. Each follow-up carries a fresh state-matched free lead
and the call CTA.

## Phase 1 — Geo-targeted sourcing from free registries (safe) — ✅ SHIPPED

- **Area-code → state map** (`lib/geo/area-codes.ts`) — enter "602, 480, TX" on `/app/growth` and it resolves to the right states.
- Discovery (`lib/growth/discover-llm.ts`) now **biases hard to target states** and is told to mine the **RMAI directory + state regulator registries** (TX SOS bonded-collector search, CA DFPI via NMLS) named in research, and to **capture each firm's state + phone**.
- Config carries `states` + `areaCodes`; the desk has a geo-targeting control.

> Honest limit: registry coverage is consumer-debt collectors/buyers; brokers
> and funds still come from web search — we blend both. A future hardening is a
> `workers/brokers.py` that pulls the registries directly (they're JS-rendered /
> migrating portals, so that's its own task).

## Phase 2 — The "free bank lead" hook (safe) — ✅ SHIPPED

Each outreach email now features **one real, current strong-signal seller** from
the live radar as free proof ("This week our radar flagged *Western Alliance
(WAL) — charge-offs up sharply* — that's the kind of seller you'd see the day
they move."). Implemented in `lib/growth/compose-llm.ts` (`freeLead`) +
`lib/growth/runner.ts` (`pickFreeLead` pulls a verbatim, never-fabricated bank
from the snapshot).

- **Phase 2.1 (enhancement):** make the free lead **state-matched** to the
  prospect. Needs FDIC/NCUA state joins (SEC originators lack a clean single
  state). Pull the prospect's state from Phase 1 sourcing, then pick a radar
  seller in that state.

## Phase 3 — Inbound call-in robot (safe path) — ✅ SHIPPED (Vercel-native)

A phone number prospects **call**. The robot greets, qualifies (segment +
state), asks **explicit consent** to text or offers email, then delivers a
**state-matched free lead + trial link** and logs the caller as a growth lead.

- `app/api/voice/incoming` — Twilio Voice webhook; greets + opens the script.
- `app/api/voice/turn` — advances the deterministic slot-filling agent (`lib/voice/agent.ts`); on completion creates the lead and texts/queues the link.
- `lib/voice/twilio.ts` — signature validation, TwiML, SMS — **no SDK** (node `crypto` + `fetch`).

**Architecture note (important):** you chose **Twilio ConversationRelay**, but
ConversationRelay needs a persistent **WebSocket** host, which Vercel's
serverless runtime can't provide. So this ships as Twilio's `<Gather speech>` +
HTTP loop — the **Vercel-native equivalent of the same Twilio voice product** —
which deploys on the existing stack with zero new infra. To upgrade to true
ConversationRelay later (lower latency, full-duplex), stand up a small WS
service and swap the TwiML in `/api/voice/incoming` for
`<Connect><ConversationRelay url="wss://…"/>`. Pricing (researched): plain Voice
~$0.0085/min inbound; ConversationRelay $0.07/min; at 100–500 calls/mo this is
low tens of $/mo + ~$1–2 number rental.

**Setup:** point your Twilio number's "A call comes in" webhook at
`POST /api/voice/incoming`. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_NUMBER` (for SMS), and optionally `TWILIO_WEBHOOK_BASE` (your public
origin, for deterministic signature checks).

> SMS to the caller still requires **A2P 10DLC** registration for production
> volume (Phase 4 note). The robot always offers **email** (no TCPA exposure)
> and only texts after an explicit on-call "yes".

## Phase 4 — Outbound SMS/calls (RISKY — deferred)

Only if/when you collect **prior express written consent** (e.g. a checkbox at
signup) and complete **A2P 10DLC** registration (Sole-Proprietor brand ≈ $4
one-time + ~$2/mo campaign, per Twilio; not independently verified). Until then,
**do not** cold-call or cold-text prospects. Email + inbound voice only.

---

## Cost at low volume (100–500 prospects/mo)

- Email (Resend): existing plan, negligible marginal.
- LLM (discovery + compose + classify): a few $ to low tens/mo.
- Voice (Phase 3): low tens/mo + ~$1–2 number.
- Everything else rides the existing Vercel + GitHub-JSON stack — **no new infra**.

## Recommended order

**0 → 1 → 2.1 → 3 (ConversationRelay) →** stop. Skip Phase 4 unless you decide to
collect written consent. Phase 2 is already live; Phase 0 is a 10-minute config
+ one-line change; Phase 1 is the next real build; Phase 3 begins once you've
created a Twilio account and picked a vendor.

## Open questions (flagged by research, worth a lawyer's 30 min before voice)

- Is the confirmatory return SMS after an inbound call a "marketing" message needing separate consent? (Safest: email the link, or get explicit on-call consent.)
- State telemarketing laws (FL FTSA, OK, WA) for the inbound path.
- Beyond TX/CA, which states publish free geo-searchable debt-collector registries with contact enrichment.
