import { ImageResponse } from "next/og";

// The home-screen icon for the "Save to Reading" web app (iOS needs a PNG).
export const runtime = "edge";

export function GET(request: Request) {
  const size = Math.min(1024, Math.max(64, Number(new URL(request.url).searchParams.get("size")) || 180));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#18181b" }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          <path d="M12 7v6M9 10h6" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
