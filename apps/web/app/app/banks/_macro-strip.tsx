import type { Macro } from "@/lib/snapshot";

const TREND_ICON: Record<string, string> = { rising: "▲", falling: "▼", flat: "—" };

// For credit-stress series, rising = worse (more supply, tougher recovery).
function stressTone(trend: string): string {
  if (trend === "rising") return "text-[color:var(--color-warn)]";
  if (trend === "falling") return "text-[color:var(--color-success)]";
  return "text-[color:var(--color-fg-faint)]";
}

// For unemployment, rising = worse.
function unemploymentTone(trend: string): string {
  return stressTone(trend);
}

function fmtYoY(n: number | null): string {
  if (n === null) return "";
  return ` ${n >= 0 ? "+" : ""}${n.toFixed(2)} YoY`;
}

/** Macro backdrop for the radar: national consumer-credit stress, plus the
 * filtered state's unemployment when a location filter is active. */
export function MacroStrip({ macro, loc }: { macro?: Macro | null; loc?: string }) {
  if (!macro || (macro.national.length === 0 && Object.keys(macro.states).length === 0)) {
    return null;
  }

  const code = (loc || "").trim().toUpperCase();
  const state = code.length === 2 ? macro.states[code] : undefined;

  const directionLabel =
    macro.stress_direction === "rising"
      ? "Consumer credit stress rising — more supply likely"
      : macro.stress_direction === "easing"
        ? "Consumer credit stress easing nationally"
        : "Consumer credit stress mixed";

  return (
    <div className="mb-8 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Macro backdrop · FRED
        </div>
        <div className="text-[12px] text-[color:var(--color-fg-dim)]">{directionLabel}</div>
      </div>

      <div className="mt-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
        {macro.national.map((s) => (
          <div key={s.key} className="flex items-baseline gap-1.5" title={`as of ${s.as_of}`}>
            <span className="text-[12px] text-[color:var(--color-fg-dim)]">{s.label}</span>
            <span className="font-mono text-[13px] text-[color:var(--color-fg)]">{s.value}%</span>
            <span className={`font-mono text-[11px] ${stressTone(s.trend)}`}>
              {TREND_ICON[s.trend]}
              <span className="text-[color:var(--color-fg-faint)]">{fmtYoY(s.yoy_change)}</span>
            </span>
          </div>
        ))}
      </div>

      {state && (
        <div className="mt-3 pt-3 border-t border-[color:var(--color-line)] text-[12px] text-[color:var(--color-fg-dim)]">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-2">
            {code}
          </span>
          Unemployment{" "}
          <span className="font-mono text-[color:var(--color-fg)]">{state.unemployment}%</span>
          <span className={`font-mono ml-1.5 ${unemploymentTone(state.trend)}`}>
            {TREND_ICON[state.trend]}
            {fmtYoY(state.yoy_change)}
          </span>
          {state.trend === "rising" && (
            <span className="ml-2 text-[color:var(--color-fg-faint)]">
              — rising local unemployment tends to lift charge-off supply and
              compress recovery; price accordingly.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
