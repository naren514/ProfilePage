import { ImageResponse } from "next/og";
import { SITE_NAME, siteUrl } from "@/lib/site";

// Share cards (1200×630) for posts and weekly lists: what LinkedIn, X and
// messaging apps show when a link is shared. Calm and typographic, like
// the site.

export const OG_SIZE = { width: 1200, height: 630 };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function shareCard({ eyebrow, title, lines = [], footer }: { eyebrow: string; title: string; lines?: string[]; footer?: string }) {
  const host = siteUrl().replace(/^https?:\/\//, "");
  const titleSize = title.length > 70 ? 54 : title.length > 40 ? 64 : 76;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fafaf9", color: "#18181b", padding: "72px 80px", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#71717a", fontFamily: "sans-serif" }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: titleSize, lineHeight: 1.12, letterSpacing: -1 }}>{clip(title, 120)}</div>
          {lines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 28, color: "#52525b", fontFamily: "sans-serif" }}>
              {lines.slice(0, 3).map((l, i) => (
                <div key={i} style={{ display: "flex" }}>
                  {clip(l, 80)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e4e4e7", paddingTop: 28, fontSize: 26, color: "#52525b", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", color: "#18181b" }}>{SITE_NAME}</div>
          <div style={{ display: "flex" }}>{footer ?? host}</div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
