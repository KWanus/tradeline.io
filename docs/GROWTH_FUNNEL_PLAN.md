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
- [ ] Set `GROWTH_POSTAL_ADDRESS` (a real street address, registered USPS PO box, or CMRA mailbox). **Legally required.**
- [ ] Add a short ad-identifier line to the footer (e.g. "This is a one-time outreach from Tradeline."). One-line code change.
- [x] Opt-outs honored well within 10 business days (ours are instant).

## Phase 1 — Geo-targeted sourcing from free registries (safe, ~1–2 days)

Today discovery uses live web search with a free-text `geo`. Make it precise and
add the **cheapest reliable public registries** found in research:

- **RMAI certified-business directory** — searchable/sortable by **state** and member type (debt buyers, collection agencies, collection law firms).
- **Texas SOS bonded debt-collector search** — free, searchable by city/state/zip.
- **California DFPI debt-collection licensees via NMLS Consumer Access** — publishes **phone, email, website** per licensee. The per-state registry pattern generalizes (NY/FL/IL next).

Build:
- Area-code → state/region map (static table) so you can target "everyone in the 602/480 area" → AZ.
- A `workers/brokers.py`-style public-source module (matches the project's worker convention) that pulls these registries into a normalized `prospects` list (firm, state, phone, email when public), feeding the existing growth queue. Label proxies as proxies per CLAUDE.md.
- UI: a state / area-code selector on `/app/growth` that sets `geo`.

> Honest limit: registry coverage is consumer-debt collectors/buyers; brokers
> and funds still come from web search. We blend both.

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

## Phase 3 — Inbound call-in robot (safe path; needs your Twilio acct)

A phone number prospects **call** (put it in the email + tour). A voice agent
qualifies them (segment, state, what they buy), then **emails** the signup link
(safe) or texts it **after explicit on-call consent**. Logs the caller as a lead.

**Vendor options (researched pricing):**

| Option | Price | Notes |
|--------|-------|-------|
| **Twilio ConversationRelay** (recommended) | **$0.07/min** + Voice API (~$0.0085/min inbound) | Native LLM wiring, webhooks straight to a Next.js route — fits the stack with least new infra. ~1s latency. |
| **Retell AI** | $0.07/min flat | STT, numbers, branded calls, batch included; LLM-agnostic. |
| **Vapi** | ~$0.05/min platform + providers (~$0.11–0.17 all-in) | Lowest latency (sub-500ms), most full-stack. |
| Twilio plain IVR | cheapest | "Press 1 to get a text/email with the link" — no AI. A fine MVP. |

At **100–500 inbound prospects/month** any of these is **low tens of dollars/mo**
+ ~$1–2 number rental. Start with **ConversationRelay** (or even plain IVR for a
day-1 MVP), wired to a new `apps/web/app/api/voice/*` route that reuses the
classifier + lead store.

Build:
- Twilio number → webhook → `/api/voice/incoming` (TwiML / ConversationRelay).
- LLM prompt: qualify + offer to email the link; capture consent if texting.
- On hangup → create a growth lead + email/SMS the `/tour` + signup link → Stripe.

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
