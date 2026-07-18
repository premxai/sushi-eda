import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sushi — Your RAW Data Served Perfectly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trysushi.xyz";
const asset = (path: string) => new URL(path, SITE_URL).toString();

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          backgroundColor: "#fff7ea",
          backgroundImage: `url(${asset("/sushi/hero/background-paper-16x9.webp")})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          color: "#101a1c",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          padding: "54px 62px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", position: "relative", width: 660, zIndex: 2 }}>
          <div style={{ alignItems: "center", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 29, fontWeight: 700, gap: 13 }}>
            <div
              style={{
                alignItems: "center",
                background: "#d86645",
                borderRadius: "50%",
                color: "#fff7ea",
                display: "flex",
                fontSize: 23,
                height: 45,
                justifyContent: "center",
                width: 45,
              }}
            >
              寿
            </div>
            Sushi
          </div>

          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Georgia, serif", fontSize: 67, letterSpacing: "-3px", lineHeight: 0.95, marginTop: 82 }}>
            <span>Your <span style={{ color: "#d86645" }}>RAW</span> Data</span>
            <span>Served <span style={{ color: "#d86645" }}>Perfectly.</span></span>
          </div>

          <div style={{ color: "#4f5352", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 24, lineHeight: 1.35, marginTop: 31, width: 525 }}>
            Upload a data file. Get a clear report with quality checks, charts, and practical findings.
          </div>

          <div style={{ alignItems: "center", color: "#5f7e4b", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 700, gap: 13, marginTop: 32 }}>
            <span style={{ background: "#5f7e4b", borderRadius: "50%", height: 10, width: 10 }} />
            CSV · TSV · XLSX · JSON · Parquet · SQLite
          </div>
        </div>

        <div style={{ bottom: 0, display: "flex", height: 630, position: "absolute", right: -5, width: 610, zIndex: 1 }}>
          <img
            alt="Sushi chef preparing a data-filled sushi roll"
            src={asset("/sushi/hero/chef-transparent.png")}
            style={{ height: 630, objectFit: "contain", objectPosition: "right bottom", width: 610 }}
          />
        </div>

        <div
          style={{
            background: "rgba(255, 252, 245, 0.96)",
            border: "1px solid #e6d7c5",
            borderRadius: 20,
            bottom: 54,
            boxShadow: "0 18px 38px rgba(57, 36, 17, 0.16)",
            display: "flex",
            flexDirection: "column",
            padding: "18px 20px",
            position: "absolute",
            right: 365,
            width: 252,
            zIndex: 3,
          }}
        >
          <span style={{ color: "#d86645", fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.3 }}>SUSHI REPORT</span>
          <span style={{ fontFamily: "Arial, sans-serif", fontSize: 21, fontWeight: 700, marginTop: 9 }}>Clear findings, fast.</span>
          <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
            <span style={{ background: "#d86645", borderRadius: 3, height: 36, width: 16 }} />
            <span style={{ alignSelf: "flex-end", background: "#5f7e4b", borderRadius: 3, height: 25, width: 16 }} />
            <span style={{ background: "#d86645", borderRadius: 3, height: 48, width: 16 }} />
            <span style={{ alignSelf: "flex-end", background: "#5f7e4b", borderRadius: 3, height: 31, width: 16 }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
