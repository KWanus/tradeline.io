"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSET_CLASS_OPTIONS,
  DEMO_SUBSCRIBERS,
  loadFromStorage,
  loadAlertLog,
  newId,
  PLAN_DETAILS,
  PLANS_ORDERED,
  saveToStorage,
  saveAlertLog,
  SIGNAL_TYPE_LABEL,
  SIGNAL_TYPE_OPTIONS,
  SUBSCRIBER_TYPE_LABEL,
  type AlertLogEntry,
  type DeliveryChannel,
  type Subscriber,
  type SubscriberPlan,
  type SubscriberType,
} from "@/lib/subscribers";
import type { Originator, RadarSnapshot, SecSignal } from "@/lib/snapshot";

type SendApiResult = {
  ok: boolean;
  summary: { sent: number; preview: number; failed: number };
  results: Array<{
    subscriberId: string;
    subscriberOrg: string;
    recipientAddress: string;
    channel: DeliveryChannel;
    subject: string;
    signalSourceId: string;
    signalTicker: string;
    signalType: string;
    confidence: number;
    status: "sent" | "preview" | "failed";
    failureReason?: string;
    htmlPreview?: string;
  }>;
};

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  email: "Email",
  slack: "Slack",
  webhook: "Webhook",
};

// Score how many alerts a subscriber would get from the current snapshot
// based on their preferences.
function alertsFor(s: Subscriber, signals: SecSignal[]): SecSignal[] {
  return signals.filter((sig) => {
    if (s.preferences.tickers.length > 0 && !s.preferences.tickers.includes(sig.ticker)) {
      return false;
    }
    if (
      s.preferences.signalTypes.length > 0 &&
      !s.preferences.signalTypes.includes(sig.signal_type)
    ) {
      return false;
    }
    if (sig.confidence < s.preferences.minConfidence) return false;
    return true;
  });
}

export function SubscribersBoard({ snapshot }: { snapshot: RadarSnapshot }) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [alertLog, setAlertLogState] = useState<AlertLogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<Subscriber | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendBanner, setSendBanner] = useState<{
    summary: SendApiResult["summary"];
    timestamp: string;
  } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    setSubscribers(loadFromStorage());
    setAlertLogState(loadAlertLog());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(subscribers);
  }, [subscribers, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveAlertLog(alertLog);
  }, [alertLog, hydrated]);

  async function callSendApi(
    targetSubscribers: Subscriber[],
    signalIds?: string[]
  ): Promise<SendApiResult | null> {
    if (targetSubscribers.length === 0) return null;
    setSending(true);
    try {
      const r = await fetch("/api/alerts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribers: targetSubscribers, signalIds }),
      });
      const data: SendApiResult = await r.json();
      if (!r.ok || !data.ok) {
        return null;
      }
      const now = new Date().toISOString();
      const newEntries: AlertLogEntry[] = data.results.map((res) => ({
        id: newId(),
        subscriberId: res.subscriberId,
        subscriberOrg: res.subscriberOrg,
        recipientAddress: res.recipientAddress,
        channel: res.channel,
        subject: res.subject,
        signalSourceId: res.signalSourceId,
        signalTicker: res.signalTicker,
        signalType: res.signalType,
        confidence: res.confidence,
        status: res.status,
        failureReason: res.failureReason,
        sentAt: now,
      }));
      setAlertLogState((prev) => [...prev, ...newEntries]);
      setSendBanner({ summary: data.summary, timestamp: now });
      // If everything was preview-mode, surface the first HTML preview
      if (data.summary.sent === 0 && data.results.length > 0) {
        const firstWithHtml = data.results.find((r) => r.htmlPreview);
        if (firstWithHtml?.htmlPreview) setPreviewHtml(firstWithHtml.htmlPreview);
      }
      return data;
    } catch {
      return null;
    } finally {
      setSending(false);
    }
  }

  const sendAllNow = () => callSendApi(subscribers);
  const sendForOne = (sub: Subscriber) => callSendApi([sub]);

  const upsert = (s: Subscriber) => {
    setSubscribers((prev) => {
      const i = prev.findIndex((x) => x.id === s.id);
      if (i === -1) return [s, ...prev];
      const next = [...prev];
      next[i] = s;
      return next;
    });
    setEditing(null);
    setShowForm(false);
  };

  const remove = (id: string) =>
    setSubscribers((prev) => prev.filter((s) => s.id !== id));

  const seedDemo = () => {
    const now = new Date().toISOString();
    setSubscribers((prev) => [
      ...DEMO_SUBSCRIBERS.map((s) => ({
        ...s,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      })),
      ...prev,
    ]);
  };

  const stats = useMemo(() => {
    const totalMrr = subscribers.reduce((s, x) => s + x.mrrUsd, 0);
    const byPlan: Record<SubscriberPlan, number> = {
      trial: 0,
      starter: 0,
      pro: 0,
      enterprise: 0,
      "fund-of-funds": 0,
    };
    for (const s of subscribers) byPlan[s.plan]++;
    const totalAlerts = subscribers.reduce(
      (s, x) => s + alertsFor(x, snapshot.top_signals).length,
      0
    );
    return { totalMrr, totalAlerts, byPlan, totalCount: subscribers.length };
  }, [subscribers, snapshot]);

  if (!hydrated) {
    return (
      <div className="card p-6 text-center text-[color:var(--color-fg-dim)]">
        Loading subscribers…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Subscribers" value={stats.totalCount} />
        <Stat
          label="MRR"
          value={formatUSD(stats.totalMrr)}
          sub={`$${(stats.totalMrr * 12).toLocaleString()} ARR`}
          tone="strong"
        />
        <Stat
          label="Alerts firing today"
          value={stats.totalAlerts}
          sub="From current snapshot"
          tone={stats.totalAlerts > 0 ? "ok" : "default"}
        />
        <Stat
          label="Plan mix"
          value={
            stats.totalCount > 0
              ? `${stats.byPlan.pro || 0}P · ${stats.byPlan.enterprise || 0}E`
              : "—"
          }
          sub={`${stats.byPlan.starter} starter · ${stats.byPlan.trial} trial`}
        />
      </section>

      {/* Actions */}
      <section className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add subscriber
        </button>
        {subscribers.length > 0 && (
          <button
            type="button"
            onClick={sendAllNow}
            disabled={sending}
            className="btn-secondary disabled:opacity-50"
          >
            {sending ? "Sending…" : `Send today's alerts (${stats.totalAlerts})`}
          </button>
        )}
        {subscribers.length === 0 && (
          <button
            type="button"
            onClick={seedDemo}
            className="btn-secondary"
          >
            Load 3 demo subscribers
          </button>
        )}
        {subscribers.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all subscribers from this device?")) {
                setSubscribers([]);
                setAlertLogState([]);
              }
            }}
            className="text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear all
          </button>
        )}
        <span className="text-[11px] text-[color:var(--color-fg-faint)] ml-auto">
          Saved on this device only · Phase 2 swaps to Postgres + auth
        </span>
      </section>

      {/* Send result banner */}
      {sendBanner && (
        <section className="card-elevated p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                Last send
              </div>
              <div className="mt-1 text-[15px] text-[color:var(--color-fg)]">
                <span className="text-[color:var(--color-accent)] font-medium">
                  {sendBanner.summary.sent}
                </span>{" "}
                sent
                <span className="text-[color:var(--color-fg-faint)]"> · </span>
                <span className="text-[color:var(--color-warn)] font-medium">
                  {sendBanner.summary.preview}
                </span>{" "}
                preview-only (no API key or test addresses)
                <span className="text-[color:var(--color-fg-faint)]"> · </span>
                <span className="text-[color:var(--color-danger)] font-medium">
                  {sendBanner.summary.failed}
                </span>{" "}
                failed
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-fg-faint)]">
                {new Date(sendBanner.timestamp).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSendBanner(null)}
              className="text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* HTML preview modal */}
      {previewHtml && (
        <section className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6 overflow-auto">
          <div className="max-w-3xl w-full bg-white rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase text-gray-500">
                  Alert preview · what the recipient sees
                </div>
                <div className="text-[12px] text-gray-600 mt-0.5">
                  Without RESEND_API_KEY this is what would be sent. Set the env var to deliver for real.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="text-[12px] text-gray-700 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
            <iframe
              srcDoc={previewHtml}
              className="w-full flex-1 bg-white"
              sandbox=""
              title="Alert preview"
            />
          </div>
        </section>
      )}

      {showForm && (
        <SubscriberForm
          initial={editing}
          onSave={upsert}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Subscriber list */}
      {subscribers.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          <p className="font-serif text-[20px] text-[color:var(--color-fg)] italic">
            No subscribers yet.
          </p>
          <p className="mt-2 text-[14px]">
            Click <em>Add subscriber</em> to record a paying customer, or load 3 demo
            entries to see how the dashboard works.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {subscribers.map((s) => (
            <SubscriberRow
              key={s.id}
              subscriber={s}
              alerts={alertsFor(s, snapshot.top_signals)}
              originators={snapshot.originators}
              recentLog={alertLog
                .filter((l) => l.subscriberId === s.id)
                .slice(-5)
                .reverse()}
              sending={sending}
              onSendForOne={() => sendForOne(s)}
              onEdit={() => {
                setEditing(s);
                setShowForm(true);
              }}
              onDelete={() => remove(s.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function SubscriberRow({
  subscriber,
  alerts,
  originators,
  recentLog,
  sending,
  onSendForOne,
  onEdit,
  onDelete,
}: {
  subscriber: Subscriber;
  alerts: SecSignal[];
  originators: Originator[];
  recentLog: AlertLogEntry[];
  sending: boolean;
  onSendForOne: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const planInfo = PLAN_DETAILS[subscriber.plan];
  return (
    <article className="card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif italic text-[22px] text-[color:var(--color-fg)] tracking-tight">
            {subscriber.orgName}
          </h3>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-faint)]">
            {SUBSCRIBER_TYPE_LABEL[subscriber.type]} · {subscriber.contactName} ·{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              {subscriber.contactEmail}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] tracking-[0.16em] uppercase px-2 py-1 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)]">
            {planInfo.label} · {formatUSD(subscriber.mrrUsd)}/mo
          </span>
          <button
            type="button"
            onClick={onSendForOne}
            disabled={sending || alerts.length === 0}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-accent-dim)] rounded-md text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] disabled:opacity-40 transition"
          >
            {sending ? "Sending…" : alerts.length === 0 ? "No alerts to send" : `Send (${alerts.length})`}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md hover:border-[color:var(--color-fg)] transition"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this subscriber?")) onDelete();
            }}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Del
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Originators">
          {subscriber.preferences.tickers.length === 0
            ? "All tracked banks"
            : subscriber.preferences.tickers.join(" · ")}
        </Field>
        <Field label="Signal types">
          {subscriber.preferences.signalTypes.length === 0
            ? "All signal types"
            : subscriber.preferences.signalTypes
                .map((s) => SIGNAL_TYPE_LABEL[s] || s)
                .join(", ")}
        </Field>
        <Field label="Min confidence">
          {subscriber.preferences.minConfidence.toFixed(2)}
        </Field>
        <Field label="Delivery">
          {CHANNEL_LABEL[subscriber.preferences.deliveryChannel]} ·{" "}
          <span className="text-[color:var(--color-fg-dim)]">
            {subscriber.preferences.deliveryAddress}
          </span>
        </Field>
      </div>

      {subscriber.notes && (
        <p className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed border-l-2 border-[color:var(--color-line)] pl-3">
          {subscriber.notes}
        </p>
      )}

      {/* Alerts firing for them */}
      <div className="mt-5 border-t border-[color:var(--color-line)] pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Alerts firing today
          </div>
          <div
            className={`text-[12px] font-mono ${
              alerts.length > 0
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-fg-faint)]"
            }`}
          >
            {alerts.length} match{alerts.length === 1 ? "" : "es"}
          </div>
        </div>
        {alerts.length === 0 ? (
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-faint)]">
            No alerts match this subscriber&rsquo;s preferences from the current snapshot.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 5).map((a) => {
              const o = originators.find((x) => x.ticker === a.ticker);
              return (
                <li
                  key={a.source_id}
                  className="flex items-center gap-3 text-[13px]"
                >
                  <span className="font-mono text-[14px] text-[color:var(--color-accent)] w-14">
                    {a.ticker}
                  </span>
                  <span className="text-[color:var(--color-fg)] flex-1 truncate">
                    {SIGNAL_TYPE_LABEL[a.signal_type] || a.signal_type}
                  </span>
                  <span className="text-[color:var(--color-fg-faint)] text-[12px]">
                    {o?.name?.split(" ")[0] || ""} · conf{" "}
                    {a.confidence.toFixed(2)}
                  </span>
                </li>
              );
            })}
            {alerts.length > 5 && (
              <li className="text-[12px] text-[color:var(--color-fg-faint)]">
                + {alerts.length - 5} more
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Recent send log per subscriber */}
      {recentLog.length > 0 && (
        <div className="mt-4 border-t border-[color:var(--color-line)] pt-4">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
            Recent send history
          </div>
          <ul className="space-y-1.5">
            {recentLog.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 text-[12px] font-mono"
              >
                <span
                  className={`text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded ${
                    l.status === "sent"
                      ? "text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                      : l.status === "preview"
                      ? "text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
                      : "text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
                  }`}
                >
                  {l.status}
                </span>
                <span className="text-[color:var(--color-accent)]">{l.signalTicker}</span>
                <span className="text-[color:var(--color-fg-dim)] flex-1 truncate">
                  {l.subject}
                </span>
                <span className="text-[color:var(--color-fg-faint)] text-[10px]">
                  {new Date(l.sentAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function SubscriberForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Subscriber | null;
  onSave: (s: Subscriber) => void;
  onCancel: () => void;
}) {
  const [orgName, setOrgName] = useState(initial?.orgName || "");
  const [contactName, setContactName] = useState(initial?.contactName || "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail || "");
  const [type, setType] = useState<SubscriberType>(initial?.type || "broker");
  const [plan, setPlan] = useState<SubscriberPlan>(initial?.plan || "starter");
  const [mrrUsd, setMrrUsd] = useState(
    initial?.mrrUsd?.toString() || PLAN_DETAILS.starter.mrrUsd.toString()
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate || new Date().toISOString().slice(0, 10)
  );
  const [tickersText, setTickersText] = useState(
    initial?.preferences.tickers.join(", ") || ""
  );
  const [signalTypes, setSignalTypes] = useState<string[]>(
    initial?.preferences.signalTypes || []
  );
  const [assetClasses, setAssetClasses] = useState<string[]>(
    initial?.preferences.assetClasses || []
  );
  const [minConfidence, setMinConfidence] = useState(
    initial?.preferences.minConfidence.toString() || "0.5"
  );
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>(
    initial?.preferences.deliveryChannel || "email"
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initial?.preferences.deliveryAddress || ""
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id || newId(),
      orgName: orgName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      type,
      plan,
      mrrUsd: Number(mrrUsd) || 0,
      startDate,
      preferences: {
        tickers: tickersText
          .split(/[,\s]+/)
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean),
        signalTypes,
        assetClasses,
        minConfidence: Number(minConfidence) || 0,
        deliveryChannel,
        deliveryAddress: deliveryAddress.trim(),
      },
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    });
  };

  const toggle = (
    arr: string[],
    setArr: (v: string[]) => void,
    v: string
  ) => {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  return (
    <form onSubmit={submit} className="card-elevated p-6">
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-5">
        {initial ? "Edit subscriber" : "New subscriber"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Org name" value={orgName} onChange={setOrgName} required />
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as SubscriberType)}
          options={Object.entries(SUBSCRIBER_TYPE_LABEL).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
        />
        <Input
          label="Contact name"
          value={contactName}
          onChange={setContactName}
        />
        <Input
          label="Contact email"
          value={contactEmail}
          onChange={setContactEmail}
          type="email"
        />
        <Select
          label="Plan"
          value={plan}
          onChange={(v) => {
            setPlan(v as SubscriberPlan);
            setMrrUsd(PLAN_DETAILS[v as SubscriberPlan].mrrUsd.toString());
          }}
          options={PLANS_ORDERED.map((p) => ({
            value: p,
            label: `${PLAN_DETAILS[p].label} · $${PLAN_DETAILS[p].mrrUsd}/mo`,
          }))}
        />
        <Input
          label="MRR (USD)"
          value={mrrUsd}
          onChange={setMrrUsd}
          type="number"
        />
        <Input
          label="Start date"
          value={startDate}
          onChange={setStartDate}
          type="date"
        />
        <Select
          label="Delivery channel"
          value={deliveryChannel}
          onChange={(v) => setDeliveryChannel(v as DeliveryChannel)}
          options={[
            { value: "email", label: "Email" },
            { value: "slack", label: "Slack webhook" },
            { value: "webhook", label: "Generic webhook (POST)" },
          ]}
        />
        <Input
          label="Delivery address"
          value={deliveryAddress}
          onChange={setDeliveryAddress}
          placeholder={
            deliveryChannel === "email"
              ? "alerts@example.com"
              : "https://hooks.slack.com/..."
          }
        />
        <Input
          label="Min confidence (0-1)"
          value={minConfidence}
          onChange={setMinConfidence}
          type="number"
        />
      </div>

      {/* Tickers */}
      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Originators (comma-separated tickers · empty = all)
        </label>
        <input
          type="text"
          value={tickersText}
          onChange={(e) => setTickersText(e.target.value)}
          placeholder="e.g. FITB, HBAN, WAL, EWBC"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>

      {/* Signal type checkboxes */}
      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Signal types (none selected = all)
        </label>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_TYPE_OPTIONS.map((s) => {
            const on = signalTypes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(signalTypes, setSignalTypes, s)}
                className={`text-[12px] px-3 py-1.5 rounded-md border transition ${
                  on
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                }`}
              >
                {SIGNAL_TYPE_LABEL[s] || s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset class checkboxes */}
      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Asset classes (none selected = all)
        </label>
        <div className="flex flex-wrap gap-2">
          {ASSET_CLASS_OPTIONS.map((a) => {
            const on = assetClasses.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(assetClasses, setAssetClasses, a)}
                className={`text-[12px] px-3 py-1.5 rounded-md border transition ${
                  on
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes — onboarding context, escalation channels, expansion conversations…"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary">
          {initial ? "Save" : "Add subscriber"}
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
