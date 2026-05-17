import { ImageResponse } from "next/og";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";

export const runtime = "nodejs";
export const alt = "Tradeline weekly charge-off report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default async function ReportOg() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const totalBanks = snap.originators.length || 57;
  const strong = snap.originators.filter((o) => statusFor(o) === "strong").length;
  const watching = snap.originators.filter((o) => statusFor(o) === "watching").length;
  const week = isoWeek(new Date());

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
            "radial-gradient(ellipse 900px 600px at 15% 15%, rgba(245, 166, 35, 0.18), transparent 70%), radial-gradient(ellipse 800px 500px at 88% 88%, rgba(236, 72, 153, 0.18), transparent 70%)",
          color: "#f3efe6",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "38px",
              fontStyle: "italic",
              color: "#1a0c00",
              fontWeight: 500,
            }}
          >
            T
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "32px", fontStyle: "italic", letterSpacing: "-0.5px" }}>
              Tradeline weekly
            </div>
            <div
              style={{
                fontFamily: "Menlo, ui-monospace, monospace",
                fontSize: "14px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#797569",
                marginTop: "4px",
              }}
            >
              {week}
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "108px",
              lineHeight: 0.95,
              letterSpacing: "-3px",
              maxWidth: "1050px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>
              The{" "}
              <span
                style={{
                  fontStyle: "italic",
                  backgroundImage:
                    "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {totalBanks}-Bank
              </span>
            </span>
            <span style={{ fontStyle: "italic", color: "#b4afa3" }}>Charge-Off</span>
            <span>Report.</span>
          </div>
        </div>

        {/* Stat strip */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            fontFamily: "system-ui",
          }}
        >
          <div style={{ display: "flex", gap: "48px" }}>
            <Stat label="Banks" value={String(totalBanks)} accent="#f5a623" />
            <Stat label="Calling now" value={String(strong)} accent="#ec4899" />
            <Stat label="Watching" value={String(watching)} accent="#fb923c" />
          </div>
          <div
            style={{
              fontSize: "16px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#b4afa3",
            }}
          >
            tradeline.io / report
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontSize: "13px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          color: "#797569",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Menlo, ui-monospace, monospace",
          fontSize: "72px",
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
