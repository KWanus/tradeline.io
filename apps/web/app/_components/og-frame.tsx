/**
 * Shared layout for next/og ImageResponse cards. Renders a consistent
 * 1200x630 dark card with a brand-gradient T tile + eyebrow at the top,
 * a big italic display title in the middle, and a stat strip + canonical
 * slug at the bottom.
 *
 * Used by each public route's opengraph-image.tsx so social shares of
 * /about, /coverage, /changelog, /apply, /report all look like the same
 * family of cards without duplicating the framing.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export type OgStat = {
  label: string;
  value: string;
  accent?: string;
};

export type OgTitleLine = {
  text: string;
  italic?: boolean;
  /** Hex color OR "gradient" to paint with the brand gradient. */
  tone?: "default" | "muted" | "gradient" | string;
};

export type OgFrameProps = {
  eyebrow: string;
  /** Tiny mono code on the right side of the eyebrow row, e.g. ISO week. */
  eyebrowMeta?: string;
  /** 1-3 lines of huge title text. */
  titleLines: OgTitleLine[];
  /** Up to 4 stat tiles in the bottom strip. */
  stats?: OgStat[];
  /** Canonical slug shown bottom-right, e.g. "tradeline.io / about". */
  slug: string;
};

const BRAND_GRADIENT =
  "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)";

function toneColor(tone: OgTitleLine["tone"]): string {
  if (tone === "muted") return "#b4afa3";
  if (tone === "default" || !tone) return "#f3efe6";
  if (tone === "gradient") return "transparent"; // painted via backgroundImage
  return tone;
}

export function ogFrame(props: OgFrameProps) {
  const { eyebrow, eyebrowMeta, titleLines, stats, slug } = props;

  return (
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: BRAND_GRADIENT,
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
            <div
              style={{
                fontSize: "32px",
                fontStyle: "italic",
                letterSpacing: "-0.5px",
              }}
            >
              Tradeline
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
              {eyebrow}
            </div>
          </div>
        </div>
        {eyebrowMeta ? (
          <div
            style={{
              fontFamily: "Menlo, ui-monospace, monospace",
              fontSize: "14px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#797569",
            }}
          >
            {eyebrowMeta}
          </div>
        ) : (
          <div style={{ display: "none" }} />
        )}
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: "108px",
          lineHeight: 0.95,
          letterSpacing: "-3px",
          maxWidth: "1050px",
        }}
      >
        {titleLines.map((line, i) => (
          <span
            key={i}
            style={{
              fontStyle: line.italic ? "italic" : "normal",
              color: toneColor(line.tone),
              ...(line.tone === "gradient"
                ? {
                    backgroundImage: BRAND_GRADIENT,
                    backgroundClip: "text",
                  }
                : {}),
              display: "flex",
            }}
          >
            {line.text}
          </span>
        ))}
      </div>

      {/* Bottom: stat strip + canonical slug */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          fontFamily: "system-ui",
        }}
      >
        {stats && stats.length > 0 ? (
          <div style={{ display: "flex", gap: "48px" }}>
            {stats.map((s, i) => (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    letterSpacing: "4px",
                    textTransform: "uppercase",
                    color: "#797569",
                    marginBottom: "6px",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: "Menlo, ui-monospace, monospace",
                    fontSize: "72px",
                    color: s.accent || "#f5a623",
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "none" }} />
        )}
        <div
          style={{
            fontSize: "16px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#b4afa3",
            display: "flex",
          }}
        >
          {slug}
        </div>
      </div>
    </div>
  );
}
