"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeMatchScore,
  computeStats,
  DEMO_MATCHES,
  DEMO_PREDICTIONS,
  loadMatches,
  loadPredictions,
  newId,
  saveMatches,
  savePredictions,
  type Match,
  type Prediction,
  type PredictionStatus,
} from "@/lib/track-record";

const SIGNAL_TYPE_OPTIONS = [
  "charge_off_increase",
  "npl_ratio_increase",
  "reserve_build",
  "portfolio_sale_announced",
  "divestiture_announced",
  "guidance_change",
  "unspecified",
];

const ASSET_CLASS_OPTIONS = [
  "Credit card",
  "Auto",
  "Junior mortgage",
  "First mortgage",
  "Medical",
  "Commercial",
  "Tax lien",
  "Specialty",
];

const VENUE_OPTIONS = [
  "EverChain",
  "Debexpert",
  "NLEX",
  "DebtX",
  "Garnet Capital",
  "RMG Investments",
  "Kondaur",
  "Mission Capital",
  "Private sale",
  "Other",
];

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function relativeAge(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const days = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const STATUS_TONE: Record<PredictionStatus, string> = {
  pending:
    "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  matched:
    "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  expired:
    "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
};

export function TrackRecordBoard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showPredictionForm, setShowPredictionForm] = useState(false);
  const [editingPrediction, setEditingPrediction] = useState<Prediction | null>(
    null
  );
  const [matchingFor, setMatchingFor] = useState<Prediction | null>(null);

  useEffect(() => {
    setPredictions(loadPredictions());
    setMatches(loadMatches());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePredictions(predictions);
  }, [predictions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveMatches(matches);
  }, [matches, hydrated]);

  const stats = useMemo(
    () => computeStats(predictions, matches),
    [predictions, matches]
  );

  const upsertPrediction = (p: Prediction) => {
    setPredictions((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i === -1) return [p, ...prev];
      const next = [...prev];
      next[i] = p;
      return next;
    });
    setEditingPrediction(null);
    setShowPredictionForm(false);
  };

  const removePrediction = (id: string) => {
    setPredictions((prev) => prev.filter((p) => p.id !== id));
    setMatches((prev) => prev.filter((m) => m.predictionId !== id));
  };

  const expirePrediction = (id: string) => {
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "expired", updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const recordMatch = (
    prediction: Prediction,
    venue: string,
    listedAt: string,
    actualAssetClass: string,
    actualFaceUsd: number,
    actualRegion: string,
    notes: string
  ) => {
    const { score, daysFromFlagToListing } = computeMatchScore(prediction, {
      actualAssetClass,
      actualFaceUsd,
      actualRegion,
      listedAt,
    });
    const now = new Date().toISOString();
    const match: Match = {
      id: newId(),
      predictionId: prediction.id,
      venue,
      listedAt,
      actualAssetClass,
      actualFaceUsd,
      actualRegion,
      notes,
      matchScoreNumeric: score,
      daysFromFlagToListing,
      createdAt: now,
    };
    setMatches((prev) => [match, ...prev]);
    setPredictions((prev) =>
      prev.map((p) =>
        p.id === prediction.id ? { ...p, status: "matched", updatedAt: now } : p
      )
    );
    setMatchingFor(null);
  };

  const seedDemo = () => {
    const now = new Date().toISOString();
    const demoPredictions: Prediction[] = DEMO_PREDICTIONS.map((p, i) => ({
      ...p,
      id: i === 0 ? "demo-fitb" : i === 1 ? "demo-wal" : newId(),
      createdAt: now,
      updatedAt: now,
    }));
    const demoMatches: Match[] = DEMO_MATCHES.map((m) => ({
      ...m,
      id: newId(),
      createdAt: now,
    }));
    setPredictions((prev) => [...demoPredictions, ...prev]);
    setMatches((prev) => [...demoMatches, ...prev]);
  };

  if (!hydrated) {
    return (
      <div className="card p-6 text-center text-[color:var(--color-fg-dim)]">
        Loading track record…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* HEADLINE STATS */}
      <section className="card-elevated p-7 md:p-8">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Track record · live
        </div>
        <h2 className="mt-3 font-serif text-3xl md:text-4xl tracking-tight">
          Hit rate:{" "}
          <span className="italic text-[color:var(--color-accent)] tick">
            {stats.matched + stats.expired === 0
              ? "—"
              : `${(stats.hitRate * 100).toFixed(0)}%`}
          </span>
        </h2>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)]">
          Falsifiable Radar performance — predictions matched against real-world
          listings on auction venues.
        </p>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Predictions logged" value={stats.totalPredictions} />
          <Stat
            label="Confirmed matches"
            value={stats.matched}
            sub={`${stats.highConfidenceHits} high-confidence`}
            tone="ok"
          />
          <Stat
            label="Pending"
            value={stats.pending}
            sub="Within prediction window"
          />
          <Stat
            label="Avg lead time"
            value={
              stats.avgLeadTimeDays > 0
                ? `${Math.round(stats.avgLeadTimeDays)}d`
                : "—"
            }
            sub="From flag to listing"
            tone="strong"
          />
        </div>
      </section>

      {/* ACTIONS */}
      <section className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setEditingPrediction(null);
            setShowPredictionForm(true);
          }}
          className="btn-primary"
        >
          + Log prediction
        </button>
        {predictions.length === 0 && (
          <button type="button" onClick={seedDemo} className="btn-secondary">
            Load 4 demo predictions + 2 matches
          </button>
        )}
        {predictions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all predictions and matches from this device?")) {
                setPredictions([]);
                setMatches([]);
              }
            }}
            className="text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear all
          </button>
        )}
        <span className="text-[11px] text-[color:var(--color-fg-faint)] ml-auto">
          Saved on this device · Phase 2 ingests EverChain + Debexpert webhooks
          automatically
        </span>
      </section>

      {/* PREDICTION FORM */}
      {showPredictionForm && (
        <PredictionForm
          initial={editingPrediction}
          onSave={upsertPrediction}
          onCancel={() => {
            setShowPredictionForm(false);
            setEditingPrediction(null);
          }}
        />
      )}

      {/* MATCH FORM */}
      {matchingFor && (
        <MatchForm
          prediction={matchingFor}
          onSave={(venue, listedAt, ac, face, region, notes) =>
            recordMatch(matchingFor, venue, listedAt, ac, face, region, notes)
          }
          onCancel={() => setMatchingFor(null)}
        />
      )}

      {/* PREDICTIONS LIST */}
      {predictions.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          <p className="font-serif text-[20px] text-[color:var(--color-fg)] italic">
            No predictions logged yet.
          </p>
          <p className="mt-2 text-[14px]">
            When Radar flags a bank you believe will divest, log it here. When
            it actually lists on EverChain / Debexpert / NLEX, record the
            match. Click <em>Load demo</em> to see the shape.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {predictions.map((p) => {
            const matchesForThis = matches.filter((m) => m.predictionId === p.id);
            return (
              <PredictionRow
                key={p.id}
                prediction={p}
                matches={matchesForThis}
                onEdit={() => {
                  setEditingPrediction(p);
                  setShowPredictionForm(true);
                }}
                onDelete={() => {
                  if (
                    confirm("Delete this prediction and any associated matches?")
                  )
                    removePrediction(p.id);
                }}
                onExpire={() => {
                  if (confirm("Mark this prediction as expired (no listing happened)?"))
                    expirePrediction(p.id);
                }}
                onLogMatch={() => setMatchingFor(p)}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function PredictionRow({
  prediction,
  matches,
  onEdit,
  onDelete,
  onExpire,
  onLogMatch,
}: {
  prediction: Prediction;
  matches: Match[];
  onEdit: () => void;
  onDelete: () => void;
  onExpire: () => void;
  onLogMatch: () => void;
}) {
  return (
    <article className="card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="font-serif text-[24px] text-[color:var(--color-fg)] tracking-tight">
              <span className="font-mono text-[color:var(--color-accent)]">
                {prediction.ticker}
              </span>{" "}
              <span className="italic">{prediction.signalType.replace(/_/g, " ")}</span>
            </h3>
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-faint)]">
            Flagged {relativeAge(prediction.flaggedAt)} · confidence{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              {prediction.confidence.toFixed(2)}
            </span>{" "}
            · expected listing within {prediction.expectedListingByDays}d
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border ${STATUS_TONE[prediction.status]}`}
          >
            {prediction.status}
          </span>
          {prediction.status === "pending" && (
            <>
              <button
                type="button"
                onClick={onLogMatch}
                className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-accent-dim)] rounded-md text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
              >
                + Log match
              </button>
              <button
                type="button"
                onClick={onExpire}
                className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-fg-dim)] transition"
              >
                Mark expired
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md hover:border-[color:var(--color-fg)] transition"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Del
          </button>
        </div>
      </div>

      {/* Prediction details */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Asset class">{prediction.predictedAssetClass || "—"}</Field>
        <Field label="Face value range">
          {prediction.predictedFaceMin > 0
            ? `${formatUSD(prediction.predictedFaceMin)} – ${formatUSD(prediction.predictedFaceMax)}`
            : "—"}
        </Field>
        <Field label="Region">{prediction.predictedRegion || "—"}</Field>
        <Field label="Expected listing">
          within {prediction.expectedListingByDays}d of flag
        </Field>
      </div>

      {prediction.notes && (
        <p className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed border-l-2 border-[color:var(--color-line)] pl-3">
          {prediction.notes}
        </p>
      )}

      {/* Matches against this prediction */}
      {matches.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--color-line)] pt-5">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-3">
            Matches recorded
          </div>
          {matches.map((m) => (
            <div
              key={m.id}
              className="border-l-2 border-[color:var(--color-accent-dim)] pl-4 py-2"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="font-serif italic text-[16px] text-[color:var(--color-fg)]">
                  Listed on {m.venue} · {relativeAge(m.listedAt)}
                </div>
                <div className="font-mono text-[13px] text-[color:var(--color-accent)] tick">
                  match score {m.matchScoreNumeric.toFixed(2)} · {m.daysFromFlagToListing}d lead
                </div>
              </div>
              <div className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] grid grid-cols-3 gap-3">
                <span>{m.actualAssetClass}</span>
                <span>{formatUSD(m.actualFaceUsd)}</span>
                <span>{m.actualRegion}</span>
              </div>
              {m.notes && (
                <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {m.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function PredictionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Prediction | null;
  onSave: (p: Prediction) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState(initial?.ticker || "");
  const [signalType, setSignalType] = useState(
    initial?.signalType || "charge_off_increase"
  );
  const [confidence, setConfidence] = useState(
    initial?.confidence?.toString() || "0.7"
  );
  const [flaggedAt, setFlaggedAt] = useState(
    initial?.flaggedAt || new Date().toISOString().slice(0, 10)
  );
  const [predictedAssetClass, setPredictedAssetClass] = useState(
    initial?.predictedAssetClass || "Credit card"
  );
  const [predictedFaceMin, setPredictedFaceMin] = useState(
    initial?.predictedFaceMin?.toString() || "10000000"
  );
  const [predictedFaceMax, setPredictedFaceMax] = useState(
    initial?.predictedFaceMax?.toString() || "50000000"
  );
  const [predictedRegion, setPredictedRegion] = useState(
    initial?.predictedRegion || ""
  );
  const [expectedListingByDays, setExpectedListingByDays] = useState(
    initial?.expectedListingByDays?.toString() || "90"
  );
  const [status, setStatus] = useState<PredictionStatus>(
    initial?.status || "pending"
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id || newId(),
      ticker: ticker.trim().toUpperCase(),
      signalType,
      confidence: Number(confidence) || 0,
      flaggedAt,
      predictedAssetClass,
      predictedFaceMin: Number(predictedFaceMin) || 0,
      predictedFaceMax: Number(predictedFaceMax) || 0,
      predictedRegion: predictedRegion.trim(),
      expectedListingByDays: Number(expectedListingByDays) || 90,
      status,
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <form onSubmit={submit} className="card-elevated p-6">
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-5">
        {initial ? "Edit prediction" : "Log a new Radar prediction"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Ticker" value={ticker} onChange={setTicker} required />
        <Select
          label="Signal type"
          value={signalType}
          onChange={setSignalType}
          options={SIGNAL_TYPE_OPTIONS.map((o) => ({ value: o, label: o.replace(/_/g, " ") }))}
        />
        <Input
          label="Confidence (0-1)"
          value={confidence}
          onChange={setConfidence}
          type="number"
        />
        <Input
          label="Flagged at"
          value={flaggedAt}
          onChange={setFlaggedAt}
          type="date"
        />
        <Select
          label="Predicted asset class"
          value={predictedAssetClass}
          onChange={setPredictedAssetClass}
          options={ASSET_CLASS_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <Input
          label="Expected listing (days)"
          value={expectedListingByDays}
          onChange={setExpectedListingByDays}
          type="number"
        />
        <Input
          label="Predicted face min (USD)"
          value={predictedFaceMin}
          onChange={setPredictedFaceMin}
          type="number"
        />
        <Input
          label="Predicted face max (USD)"
          value={predictedFaceMax}
          onChange={setPredictedFaceMax}
          type="number"
        />
        <Input
          label="Predicted region"
          value={predictedRegion}
          onChange={setPredictedRegion}
          placeholder="e.g. Mid-Atlantic, Midwest"
        />
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as PredictionStatus)}
          options={[
            { value: "pending", label: "Pending" },
            { value: "matched", label: "Matched" },
            { value: "expired", label: "Expired" },
          ]}
        />
      </div>
      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why this prediction. What signals supported it. What advisor / venue is most likely."
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary">
          {initial ? "Save" : "Log prediction"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function MatchForm({
  prediction,
  onSave,
  onCancel,
}: {
  prediction: Prediction;
  onSave: (
    venue: string,
    listedAt: string,
    actualAssetClass: string,
    actualFaceUsd: number,
    actualRegion: string,
    notes: string
  ) => void;
  onCancel: () => void;
}) {
  const [venue, setVenue] = useState("EverChain");
  const [listedAt, setListedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [actualAssetClass, setActualAssetClass] = useState(
    prediction.predictedAssetClass
  );
  const [actualFaceUsd, setActualFaceUsd] = useState(
    String(
      Math.round((prediction.predictedFaceMin + prediction.predictedFaceMax) / 2)
    )
  );
  const [actualRegion, setActualRegion] = useState(prediction.predictedRegion);
  const [notes, setNotes] = useState("");

  const previewScore = computeMatchScore(prediction, {
    actualAssetClass,
    actualFaceUsd: Number(actualFaceUsd) || 0,
    actualRegion,
    listedAt,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          venue,
          listedAt,
          actualAssetClass,
          Number(actualFaceUsd) || 0,
          actualRegion,
          notes.trim()
        );
      }}
      className="card-elevated p-6"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <div>
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Log match for {prediction.ticker}
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)]">
            What you predicted: {prediction.predictedAssetClass} ·{" "}
            {formatUSD(prediction.predictedFaceMin)}–
            {formatUSD(prediction.predictedFaceMax)} ·{" "}
            {prediction.predictedRegion || "no region"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Live match score
          </div>
          <div className="font-mono text-[28px] text-[color:var(--color-accent)] tick">
            {previewScore.score.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Venue"
          value={venue}
          onChange={setVenue}
          options={VENUE_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <Input
          label="Listed at"
          value={listedAt}
          onChange={setListedAt}
          type="date"
        />
        <Select
          label="Actual asset class"
          value={actualAssetClass}
          onChange={setActualAssetClass}
          options={ASSET_CLASS_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <Input
          label="Actual face (USD)"
          value={actualFaceUsd}
          onChange={setActualFaceUsd}
          type="number"
        />
        <Input
          label="Actual region"
          value={actualRegion}
          onChange={setActualRegion}
        />
      </div>

      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Where you saw the listing. How close to prediction. Anything notable."
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary">
          Record match
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "strong" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="card p-5">
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
      {sub && (
        <div className="mt-1 text-[11px] text-[color:var(--color-fg-faint)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
