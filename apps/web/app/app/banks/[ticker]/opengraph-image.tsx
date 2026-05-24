import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";

export const runtime = "nodejs";
export const alt = "Tradeline — bank signal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_LABEL = {
  strong: "Call brokers now",
  watching: "Watching",
  quiet: "Quiet",
} as const;

const STATUS_COLOR = {
  strong: "#f5a623",
  watching: "#ffb56b",
  quiet: "#797569",
} as const;

export default async function BankOg({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const o = snap.originators.find((x) => x.ticker === ticker);
  const sig = o ? topSignalFor(o.ticker, snap.top_signals) : undefined;
  const status = o ? statusFor(o) : "quiet";
  const signalLabel = sig ? plainSignal(sig.signal_type).label : "No signal yet";
  const yoyText =
    sig && typeof sig.yoy_pct === "number"
      ? `+${Math.round(Math.abs(sig.yoy_pct))}% YoY`
      : "";
  const tierLabel = o?.tier || "tracked";
  const sigCount = o?.signals ?? 0;
  const newsCount = o?.news_mentions ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0a0b12",
          backgroundImage:
            "radial-gradient(ellipse 800px 500px at 20% 20%, rgba(var(--tint-accent-rgb), 0.15), transparent 70%), radial-gradient(ellipse 700px 400px at 85% 85%, rgba(236, 72, 153, 0.15), transparent 70%)",
          color: "#f3efe6",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top — logo + status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background:
                  "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                fontStyle: "italic",
                color: "#1a0c00",
                fontWeight: 500,
              }}
            >
              T
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                fontStyle: "italic",
                letterSpacing: "-0.5px",
              }}
            >
              Tradeline
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "system-ui",
              fontSize: "16px",
              letterSpacing: "5px",
              textTransform: "uppercase",
              padding: "10px 18px",
              borderRadius: "999px",
              color: status === "strong" ? "#1a0c00" : "#0a0b12",
              fontWeight: 700,
              background:
                status === "strong"
                  ? "linear-gradient(135deg, #f5a623, #fb923c, #ec4899)"
                  : status === "watching"
                    ? "#ffb56b"
                    : "#262835",
            }}
          >
            {STATUS_LABEL[status]}
          </div>
        </div>

        {/* Middle — ticker + bank name + signal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "28px" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Menlo, ui-monospace, monospace",
                fontSize: "180px",
                lineHeight: 1,
                color: STATUS_COLOR[status],
                letterSpacing: "-6px",
              }}
            >
              {ticker}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "system-ui",
                fontSize: "40px",
                fontWeight: 600,
                color: "#b4afa3",
                letterSpacing: "-1px",
              }}
            >
              {yoyText}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "30px",
              color: "#b4afa3",
              fontStyle: "italic",
              maxWidth: "1000px",
              lineHeight: 1.15,
            }}
          >
            {o?.name || ticker}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "40px",
              color: "#f3efe6",
              lineHeight: 1.2,
              maxWidth: "1000px",
            }}
          >
            {signalLabel}
          </div>
        </div>

        {/* Bottom — context strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "system-ui",
            fontSize: "16px",
            color: "#797569",
            letterSpacing: "2.5px",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <div style={{ display: "flex" }}>{tierLabel}</div>
            <div style={{ display: "flex" }}>·</div>
            <div style={{ display: "flex" }}>
              {sigCount} signal{sigCount === 1 ? "" : "s"}
            </div>
            {newsCount > 0 ? (
              <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ display: "flex" }}>·</div>
                <div style={{ display: "flex", color: "#fb923c" }}>
                  {newsCount} news
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", color: "#b4afa3" }}>
            tradeline.io / banks / {ticker}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
