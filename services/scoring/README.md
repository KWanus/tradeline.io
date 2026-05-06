# services/scoring

Portfolio + originator scoring service. Python / FastAPI. **Phase 2** — do not start before paying customers exist.

## Scope

- Inputs: customer-uploaded tapes (legally held), public originator features, regional macro overlay.
- Outputs: portfolio-level scores. PDF report. JSON for the MCP layer.
- **Hard constraint:** zero consumer-level features. Re-read `01_LEGAL_COMPLIANCE.md` before adding any.

## Status

Stub. Build begins Week 9 per `03_PHASE_ROADMAP.md`.
