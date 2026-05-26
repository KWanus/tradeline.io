"use client";

import { useMemo } from "react";
import type { TimeSeriesPoint, TimeSeriesReport } from "@/lib/portfolio-timeseries";

// Pure SVG, no external dependency. Renders two cumulative lines (actual
// vs model) over a monthly x-axis with a "today" vertical marker.

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 32, left: 56 };

function fmtUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function shortMonth(yyyyMm: string): string {
  // Show as MMM 'YY (e.g. "Jan '26"). YYYY-MM input.
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(date.getTime())) return yyyyMm;
  const monthShort = date.toLocaleString("en-US", { month: "short" });
  return `${monthShort} '${String(date.getFullYear()).slice(-2)}`;
}

export function TimeSeriesChart({ report }: { report: TimeSeriesReport }) {
  const { points, todayMonth, latestActualUsd, latestModelUsd, performanceRatio } = report;

  const { actualPath, modelPath, capPath, xForMonth, yScale, maxY, xLabels, todayX } =
    useMemo(() => {
      const innerWidth = WIDTH - PADDING.left - PADDING.right;
      const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
      const maxYVal = Math.max(
        ...points.map((p) => p.cumulativeLifetimeCapUsd),
        ...points.map((p) => p.cumulativeModelUsd),
        ...points.map((p) => p.cumulativeActualUsd),
        1
      );
      const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;

      const xForMonthFn = (month: string) => {
        const idx = points.findIndex((p) => p.month === month);
        if (idx < 0) {
          // If the target month is past chart end, clamp to end
          if (
            points.length > 0 &&
            month > points[points.length - 1].month
          ) {
            return PADDING.left + innerWidth;
          }
          // If before chart start, clamp to start
          return PADDING.left;
        }
        return PADDING.left + idx * xStep;
      };

      const yScaleFn = (v: number) => {
        if (maxYVal === 0) return PADDING.top + innerHeight;
        const norm = v / maxYVal;
        return PADDING.top + innerHeight - norm * innerHeight;
      };

      const buildPath = (key: keyof TimeSeriesPoint) =>
        points
          .map((p, i) => {
            const x = PADDING.left + i * xStep;
            const y = yScaleFn(Number(p[key]) || 0);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");

      // x-axis labels — show every Nth month so labels don't overlap.
      const targetLabelCount = 8;
      const stride = Math.max(1, Math.floor(points.length / targetLabelCount));
      const labels = points
        .map((p, i) => ({ p, i, x: PADDING.left + i * xStep }))
        .filter(({ i }) => i % stride === 0);

      return {
        actualPath: buildPath("cumulativeActualUsd"),
        modelPath: buildPath("cumulativeModelUsd"),
        capPath: buildPath("cumulativeLifetimeCapUsd"),
        xForMonth: xForMonthFn,
        yScale: yScaleFn,
        maxY: maxYVal,
        xLabels: labels,
        todayX: xForMonthFn(todayMonth),
      };
    }, [points, todayMonth]);

  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const perfPct = report.performanceRatio * 100;
  const perfColor =
    report.performanceRatio >= 1.1
      ? "var(--color-success)"
      : report.performanceRatio >= 0.9
      ? "var(--color-accent)"
      : report.performanceRatio > 0
      ? "var(--color-warn)"
      : "var(--color-fg-faint)";

  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Collections curve — actual vs model
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
            Cumulative $ across all holdings, monthly. Model uses the front-loaded
            recovery curve (the easy dollars come early). Solid = actual, dashed
            = expected by model, dotted = lifetime cap (model ceiling).
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Today's fit
          </div>
          <div className="font-mono text-[22px] font-semibold" style={{ color: perfColor }}>
            {report.latestModelUsd > 0 ? `${perfPct.toFixed(0)}%` : "—"}
          </div>
          <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
            Cum actual ≈ {fmtUsdShort(report.latestActualUsd)} / model {fmtUsdShort(report.latestModelUsd)}
          </div>
        </div>
      </div>

      {/* SVG chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Cumulative collections actual vs model"
          style={{ maxWidth: WIDTH }}
        >
          {/* y-axis gridlines + labels (4 ticks) */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const y = PADDING.top + innerHeight - t * innerHeight;
            const labelVal = maxY * t;
            return (
              <g key={i}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + innerWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--color-line)"
                  strokeWidth={i === 0 ? 1.5 : 1}
                  strokeDasharray={i === 0 ? undefined : "2,4"}
                  opacity={i === 0 ? 1 : 0.6}
                />
                <text
                  x={PADDING.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontFamily="monospace"
                  fill="var(--color-fg-faint)"
                >
                  {fmtUsdShort(labelVal)}
                </text>
              </g>
            );
          })}

          {/* x-axis labels */}
          {xLabels.map(({ p, x }) => (
            <text
              key={p.month}
              x={x}
              y={HEIGHT - PADDING.bottom + 14}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="var(--color-fg-faint)"
            >
              {shortMonth(p.month)}
            </text>
          ))}

          {/* Cap line (lifetime expected total) — faint dotted */}
          <path
            d={capPath}
            fill="none"
            stroke="var(--color-fg-faint)"
            strokeWidth={1}
            strokeDasharray="1,3"
            opacity={0.5}
          />

          {/* Model line — dashed accent */}
          <path
            d={modelPath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeDasharray="4,3"
            opacity={0.7}
          />

          {/* Actual line — solid, tone reflects performance */}
          <path
            d={actualPath}
            fill="none"
            stroke={perfColor}
            strokeWidth={2}
          />

          {/* Today marker — vertical line */}
          <line
            x1={todayX}
            x2={todayX}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke="var(--color-fg-dim)"
            strokeWidth={1}
            strokeDasharray="3,2"
            opacity={0.6}
          />
          <text
            x={todayX}
            y={PADDING.top - 4}
            textAnchor="middle"
            fontSize="9"
            fontFamily="monospace"
            fill="var(--color-fg-dim)"
          >
            today
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 flex-wrap font-mono text-[10px] tracking-[0.05em] text-[color:var(--color-fg-dim)]">
        <LegendItem color={perfColor} solid label="Actual cumulative" />
        <LegendItem color="var(--color-accent)" label="Model expected" dashed />
        <LegendItem color="var(--color-fg-faint)" label="Lifetime cap" dotted />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  solid,
  dashed,
  dotted,
}: {
  color: string;
  label: string;
  solid?: boolean;
  dashed?: boolean;
  dotted?: boolean;
}) {
  // ignore the `solid` prop — it's just for readability at the call site
  void solid;
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="24" height="6" aria-hidden>
        <line
          x1="1"
          y1="3"
          x2="23"
          y2="3"
          stroke={color}
          strokeWidth={dotted ? 1 : 2}
          strokeDasharray={dashed ? "4,2" : dotted ? "1,2" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
