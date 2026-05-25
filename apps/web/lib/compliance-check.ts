// Compliance shield — pure check function consumed by every action that
// could result in legal exposure for an unlicensed operator.
//
// Consumers:
//   - /api/send-outreach (pre-send gate)
//   - /app/today approval-inbox (visual block on cards in unlicensed states)
//   - Tape Copilot license card (already shown — same data source)
//   - /app/pipeline deal save (warn if account is in unlicensed state)
//   - Future: cron jobs that send scheduled outreach
//
// Posture: this is a COMPLIANCE SIGNAL, not legal advice. State-specific
// licensing, fee-related rules, and federal/state interplay vary. The
// function returns structured warnings/blockers and the operator is the
// final decision-maker. We DO block actions where it's obviously
// indefensible (no license + active expired status + protected category)
// to prevent accidental quota burn or compliance-letter risk.

import {
  daysUntil,
  licenseStatus,
  licenseTypeCoversAction,
  summarizeStateLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
  type ComplianceActionType,
  type License,
} from "./compliance-licenses";

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export type ComplianceSeverity = "block" | "warn" | "info";

export type ComplianceFinding = {
  severity: ComplianceSeverity;
  code: string; // stable identifier for the finding (used in telemetry, override flags)
  state: string;
  message: string; // 1-line human-readable
  // What the operator should do about it
  suggestion?: string;
  // Optional metadata for UI/log
  meta?: Record<string, string | number | boolean>;
};

export type ComplianceCheckResult = {
  ok: boolean; // false if any blocker present
  blockers: ComplianceFinding[];
  warnings: ComplianceFinding[];
  infos: ComplianceFinding[];
  // Convenience flag: ANY finding present, regardless of severity
  hasAnyFinding: boolean;
};

// ---------------------------------------------------------------------------
// The check function
//
// Pure: takes the action type + target state + the operator's License[].
// No localStorage reads, no fetches. Caller (route handler / UI) supplies
// the licenses. This makes the function trivially testable and reusable
// on both server (send-outreach API) and client (Today inbox cards).
// ---------------------------------------------------------------------------

export type CheckInput = {
  action: ComplianceActionType;
  state: string; // 2-letter state code of the target (consumer state, account state, etc.)
  licenses: License[]; // operator's full license records
  // Optional context flags
  isProtectedDebtCategory?: boolean; // e.g., medical debt under NY 2026 rules
  isPostStatuteSuit?: boolean; // file_suit action where SOL is lapsed
  // States that don't require any license for this action (e.g., AL/TX for
  // debt-buyer purchases). Caller may supply this to skip the no-license
  // block in those states.
  noLicenseRequiredStates?: ReadonlyArray<string>;
};

export function checkCompliance(input: CheckInput): ComplianceCheckResult {
  const blockers: ComplianceFinding[] = [];
  const warnings: ComplianceFinding[] = [];
  const infos: ComplianceFinding[] = [];

  const state = input.state.trim().toUpperCase();
  if (!state || !/^[A-Z]{2}$/.test(state)) {
    blockers.push({
      severity: "block",
      code: "invalid_state",
      state: state || "??",
      message: `Invalid state code '${input.state}'. Cannot evaluate compliance.`,
    });
    return finalize({ blockers, warnings, infos });
  }

  const summary = summarizeStateLicenses(input.licenses, state);
  const noLicenseRequired = (input.noLicenseRequiredStates ?? []).includes(state);

  // ---- No license at all -------------------------------------------------
  if (summary.licenses.length === 0) {
    if (noLicenseRequired) {
      infos.push({
        severity: "info",
        code: "no_license_required",
        state,
        message: `${state} doesn't require a license for this action — proceeding.`,
      });
    } else {
      blockers.push({
        severity: "block",
        code: "no_license_in_state",
        state,
        message: `No license recorded for ${state}. ${humanAction(input.action)} requires an active state license.`,
        suggestion: `Add the ${state} license to /app/compliance, or remove this state from the action.`,
      });
    }
  } else {
    // ---- All licenses expired -------------------------------------------
    if (summary.hasExpired && !summary.hasActive && !summary.hasExpiring) {
      const lapsed = summary.licenses
        .filter((l) => licenseStatus(l) === "expired")
        .map((l) => `${l.licenseType} (lapsed ${Math.abs(daysUntil(l.expirationDate))}d ago)`)
        .join(", ");
      blockers.push({
        severity: "block",
        code: "all_licenses_expired",
        state,
        message: `All ${state} licenses have expired: ${lapsed}.`,
        suggestion: `Renew via /app/compliance — most states take 30-60 days to process.`,
      });
    } else {
      // ---- License-type mismatch ----------------------------------------
      if (!summary.coveredActions.includes(input.action)) {
        const have = summary.licenses
          .filter((l) => licenseStatus(l) !== "expired")
          .map((l) => l.licenseType)
          .join(", ");
        blockers.push({
          severity: "block",
          code: "license_type_mismatch",
          state,
          message: `${state} licenses (${have}) don't cover '${humanAction(input.action)}'. ${neededLicenseTypeFor(input.action)} required.`,
          suggestion: `Add the required license type at /app/compliance, or route this action via a partner that holds it.`,
        });
      } else {
        // ---- Expiring soon (warn, don't block) --------------------------
        if (summary.earliestExpiringDays !== null && summary.earliestExpiringDays <= URGENT_EXPIRY_THRESHOLD_DAYS) {
          warnings.push({
            severity: "warn",
            code: "license_expiring_urgent",
            state,
            message: `${state} license expires in ${summary.earliestExpiringDays}d — renew immediately (30-60d processing).`,
            suggestion: `Open /app/compliance and start renewal paperwork now.`,
            meta: { daysToExpiry: summary.earliestExpiringDays },
          });
        }
      }
    }
  }

  // ---- Action-specific cross-checks --------------------------------------
  if (input.action === "file_suit" && input.isPostStatuteSuit) {
    blockers.push({
      severity: "block",
      code: "filing_suit_on_lapsed_sol",
      state,
      message: `Cannot file suit — the statute of limitations has expired on this account in ${state}.`,
      suggestion: `Pursue soft-collect only. Filing suit on a time-barred debt is an FDCPA violation in most states.`,
    });
  }

  if (input.isProtectedDebtCategory && (state === "NY" || state === "CO" || state === "IL")) {
    warnings.push({
      severity: "warn",
      code: "protected_debt_category",
      state,
      message: `${state} has heightened restrictions on this debt category (e.g., medical-debt credit-report bans, telecom limits). Verify with counsel before proceeding.`,
    });
  }

  return finalize({ blockers, warnings, infos });
}

function finalize(out: {
  blockers: ComplianceFinding[];
  warnings: ComplianceFinding[];
  infos: ComplianceFinding[];
}): ComplianceCheckResult {
  return {
    ok: out.blockers.length === 0,
    blockers: out.blockers,
    warnings: out.warnings,
    infos: out.infos,
    hasAnyFinding: out.blockers.length + out.warnings.length + out.infos.length > 0,
  };
}

function humanAction(a: ComplianceActionType): string {
  switch (a) {
    case "outreach_send":
      return "outreach send";
    case "bid_portfolio":
      return "portfolio bid";
    case "place_with_servicer":
      return "third-party servicer placement";
    case "file_suit":
      return "filing suit";
  }
}

function neededLicenseTypeFor(a: ComplianceActionType): string {
  switch (a) {
    case "outreach_send":
    case "file_suit":
      return "Collection-agency or Both license";
    case "bid_portfolio":
      return "Debt-buyer or Both license";
    case "place_with_servicer":
      return "Debt-buyer, Collection-agency, or Both license";
  }
}

// ---------------------------------------------------------------------------
// Batch check — for surfaces that need to evaluate many accounts at once
// (Today inbox cards, tape state distribution, pipeline list).
// ---------------------------------------------------------------------------

export function batchCheckCompliance(
  inputs: Array<Omit<CheckInput, "licenses"> & { id: string }>,
  licenses: License[],
  noLicenseRequiredStates?: ReadonlyArray<string>
): Map<string, ComplianceCheckResult> {
  const out = new Map<string, ComplianceCheckResult>();
  for (const i of inputs) {
    out.set(
      i.id,
      checkCompliance({
        action: i.action,
        state: i.state,
        licenses,
        isProtectedDebtCategory: i.isProtectedDebtCategory,
        isPostStatuteSuit: i.isPostStatuteSuit,
        noLicenseRequiredStates,
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Override token — when the operator EXPLICITLY confirms they accept the
// risk of a blocker (e.g., they're going to route via a partner), the UI
// generates this token and passes it through. The server-side handler can
// then proceed despite the block, but only for the specific codes listed.
// Token format is informational only — anyone with operator access can
// generate one; the audit log captures the override decision.
// ---------------------------------------------------------------------------

export type ComplianceOverride = {
  acceptedCodes: string[]; // codes the operator explicitly accepted (e.g., ["no_license_in_state"])
  reason: string; // operator's stated reason (logged)
  acceptedAt: string; // ISO timestamp
};

export function applyOverride(
  result: ComplianceCheckResult,
  override: ComplianceOverride | null
): ComplianceCheckResult {
  if (!override) return result;
  const accepted = new Set(override.acceptedCodes);
  const remainingBlockers = result.blockers.filter((b) => !accepted.has(b.code));
  return {
    ...result,
    blockers: remainingBlockers,
    warnings: [
      ...result.warnings,
      ...result.blockers
        .filter((b) => accepted.has(b.code))
        .map((b) => ({ ...b, severity: "warn" as ComplianceSeverity, code: `${b.code}_overridden` })),
    ],
    ok: remainingBlockers.length === 0,
    hasAnyFinding:
      remainingBlockers.length +
        result.warnings.length +
        result.infos.length +
        result.blockers.filter((b) => accepted.has(b.code)).length >
      0,
  };
}
