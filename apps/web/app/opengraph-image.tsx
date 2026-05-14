import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tradeline — debt-buyer OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
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
            "radial-gradient(ellipse 800px 500px at 20% 20%, rgba(245, 166, 35, 0.15), transparent 70%), radial-gradient(ellipse 700px 400px at 85% 85%, rgba(236, 72, 153, 0.15), transparent 70%)",
          color: "#f3efe6",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
              fontStyle: "italic",
              color: "#1a0c00",
              fontWeight: 500,
            }}
          >
            T
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "40px", fontStyle: "italic", letterSpacing: "-0.5px" }}>
              Tradeline
            </div>
            <div
              style={{
                fontSize: "14px",
                letterSpacing: "5px",
                textTransform: "uppercase",
                color: "#797569",
                fontFamily: "system-ui",
                marginTop: "4px",
              }}
            >
              Debt-buyer OS
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "108px",
              lineHeight: 0.95,
              letterSpacing: "-3px",
              maxWidth: "1000px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Find the deal</span>
            <span style={{ fontStyle: "italic", color: "#b4afa3" }}>before</span>
            <span
              style={{
                fontStyle: "italic",
                backgroundImage:
                  "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              it&rsquo;s a deal.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "system-ui",
            fontSize: "18px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                fontSize: "13px",
                letterSpacing: "4px",
                textTransform: "uppercase",
                color: "#797569",
              }}
            >
              Institutional intelligence
            </div>
            <div style={{ color: "#b4afa3" }}>
              57 banks · 9 brokers · 10 lenders · live SEC feed
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 22px",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #f5a623 0%, #fb923c 50%, #ec4899 100%)",
              color: "#1a0c00",
              fontWeight: 600,
              fontSize: "16px",
            }}
          >
            Open the radar →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
